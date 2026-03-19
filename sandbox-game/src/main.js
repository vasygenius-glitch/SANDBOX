import './style.css';
import * as THREE from 'three';
import { PlayerController } from './PlayerController.js';
import { PhysicsGun } from './PhysicsGun.js';
import { Ragdoll } from './Ragdoll.js';
import * as RAPIER from '@dimforge/rapier3d';

// Wrap everything in an async init function because RAPIER uses wasm
async function init() {
    // When using vite-plugin-wasm + topLevelAwait, rapier is often initialized differently
    // Actually @dimforge/rapier3d may not need init() or might be different version
    if (typeof RAPIER.init === 'function') {
        await RAPIER.init();
    }

    const world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
    const dynamicObjects = []; // Array to link THREE objects and RAPIER bodies

// Setup Scene, Camera, Renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue
scene.fog = new THREE.Fog(0x87ceeb, 0, 100);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 1.5); // Soft white light
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
scene.add(directionalLight);

// Ground
const groundGeometry = new THREE.PlaneGeometry(500, 500); // Expanded map
// We add a basic grid texture to give scale to the map
const gridTexture = new THREE.GridHelper(500, 100, 0x000000, 0x000000);
gridTexture.position.y = 0.01; // slightly above ground to prevent z-fighting
gridTexture.material.opacity = 0.2;
gridTexture.material.transparent = true;
scene.add(gridTexture);

const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x5a7a5a, roughness: 0.9, metalness: 0.1 }); // grass-ish color
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Ground Physics
const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
const groundBody = world.createRigidBody(groundBodyDesc);
const groundColliderDesc = RAPIER.ColliderDesc.cuboid(250, 0.1, 250); // Match expanded size
world.createCollider(groundColliderDesc, groundBody);

// Buildings (Static environment)
function createBuilding(w, h, d, x, y, z, color) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    const body = world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(w/2, h/2, d/2);
    world.createCollider(colliderDesc, body);
}

// Add some walls / simple buildings around the starting area
createBuilding(20, 10, 2, 0, 5, -20, 0x888888); // back wall
createBuilding(2, 10, 20, -10, 5, -10, 0x888888); // left wall
createBuilding(10, 5, 10, 15, 2.5, -15, 0xaa5555); // red building block
createBuilding(5, 15, 5, -20, 7.5, 10, 0x5555aa); // blue tower

// Player Physics
const playerBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 2, 5); // Start as kinematic, can change to dynamic later
// Actually, let's make it a dynamic character
const playerDynamicDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(0, 2, 5)
    .lockRotations(); // Prevent player from tipping over
const playerBody = world.createRigidBody(playerDynamicDesc);
const playerColliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.4); // half-height, radius
world.createCollider(playerColliderDesc, playerBody);


// Player Controller
const playerController = new PlayerController(camera, renderer.domElement);
playerController.setPhysicsBody(playerBody, world);

// Physics Gun
const physicsGun = new PhysicsGun(camera, scene, world, dynamicObjects);

// Helper to get spawn position in front of camera
function getSpawnPosition(distance = 4) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    // Ignore pitch, spawn roughly level with the player
    dir.y = 0;
    dir.normalize();

    // Default spawn slightly above ground
    const spawnPos = camera.position.clone().add(dir.multiplyScalar(distance));
    spawnPos.y = Math.max(camera.position.y, 2.0);
    return spawnPos;
}

// Q-Menu Spawn Logic
document.getElementById('spawn-cube').addEventListener('click', () => {
    const size = 0.5 + Math.random() * 1;
    const color = Math.random() * 0xffffff;

    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size * 2, size * 2, size * 2),
        new THREE.MeshStandardMaterial({ color: color, roughness: 0.4, metalness: 0.1 })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const spawnPos = getSpawnPosition();
    // Enable Continuous Collision Detection (CCD) to prevent clipping at high speeds
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
        .setCcdEnabled(true);

    const body = world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(size, size, size).setMass(size * 10);
    world.createCollider(colliderDesc, body);

    dynamicObjects.push({ mesh, body });
});

document.getElementById('spawn-sphere').addEventListener('click', () => {
    const radius = 0.5 + Math.random() * 0.5;
    const color = Math.random() * 0xffffff;

    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 32),
        new THREE.MeshStandardMaterial({ color: color, roughness: 0.4, metalness: 0.1 })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const spawnPos = getSpawnPosition();
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
        .setCcdEnabled(true);

    const body = world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.ball(radius).setMass(radius * 10);
    world.createCollider(colliderDesc, body);

    dynamicObjects.push({ mesh, body });
});

document.getElementById('spawn-ragdoll').addEventListener('click', () => {
    const spawnPos = getSpawnPosition(5);
    spawnPos.y += 2; // Spawn high up to see it fall

    const ragdoll = new Ragdoll(scene, world, spawnPos);
    ragdoll.bodies.forEach(b => {
        dynamicObjects.push(b);
    });
});

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Step physics
    world.step();

    // Sync meshes with physics bodies
    dynamicObjects.forEach(obj => {
        const position = obj.body.translation();
        const rotation = obj.body.rotation();

        obj.mesh.position.copy(position);
        obj.mesh.quaternion.copy(rotation);
    });

    playerController.update(delta);
    physicsGun.update();

    renderer.render(scene, camera);
}

animate();

} // end of init()

init().catch(console.error);
