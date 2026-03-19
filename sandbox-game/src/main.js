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
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8, metalness: 0.2 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Ground Physics
const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
const groundBody = world.createRigidBody(groundBodyDesc);
const groundColliderDesc = RAPIER.ColliderDesc.cuboid(50, 0.1, 50);
world.createCollider(groundColliderDesc, groundBody);

// Test Cube (Dynamic)
const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.castShadow = true;
cube.receiveShadow = true;
scene.add(cube);

const cubeBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, -5);
const cubeBody = world.createRigidBody(cubeBodyDesc);
const cubeColliderDesc = RAPIER.ColliderDesc.cuboid(1, 1, 1);
world.createCollider(cubeColliderDesc, cubeBody);

dynamicObjects.push({ mesh: cube, body: cubeBody });

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

// Spawn Objects (Key E)
window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyE') {
        const shapeType = Math.random() > 0.5 ? 'box' : 'sphere';
        const color = Math.random() * 0xffffff;
        let mesh, colliderDesc;

        if (shapeType === 'box') {
            const size = 0.5 + Math.random() * 1;
            mesh = new THREE.Mesh(
                new THREE.BoxGeometry(size * 2, size * 2, size * 2),
                new THREE.MeshStandardMaterial({ color: color, roughness: 0.4, metalness: 0.1 })
            );
            colliderDesc = RAPIER.ColliderDesc.cuboid(size, size, size);
        } else {
            const radius = 0.5 + Math.random() * 0.5;
            mesh = new THREE.Mesh(
                new THREE.SphereGeometry(radius, 32, 32),
                new THREE.MeshStandardMaterial({ color: color, roughness: 0.4, metalness: 0.1 })
            );
            colliderDesc = RAPIER.ColliderDesc.ball(radius);
        }

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        // Spawn in front of camera
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const spawnPos = camera.position.clone().add(dir.multiplyScalar(3));

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(spawnPos.x, spawnPos.y, spawnPos.z);
        const body = world.createRigidBody(bodyDesc);
        world.createCollider(colliderDesc, body);

        dynamicObjects.push({ mesh, body });
    }

    if (event.code === 'KeyR') {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const spawnPos = camera.position.clone().add(dir.multiplyScalar(4));
        spawnPos.y += 2; // Spawn a bit higher

        const ragdoll = new Ragdoll(scene, world, spawnPos);
        // add all ragdoll limbs to dynamic objects so they get rendered
        ragdoll.bodies.forEach(b => {
            dynamicObjects.push(b);
        });
    }
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
