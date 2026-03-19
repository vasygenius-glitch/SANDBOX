import './style.css';
import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d';

import { setupScene } from './SceneSetup.js';
import { createCheckerboardTexture, createCrateTexture } from './Textures.js';
import { WorldBuilder } from './WorldBuilder.js';

import { PlayerController } from './PlayerController.js';
import { PhysicsGun } from './PhysicsGun.js';
import { WeldTool } from './WeldTool.js';
import { ThrusterTool } from './ThrusterTool.js';
import { Ragdoll } from './Ragdoll.js';
import { Vehicle } from './Vehicle.js';

async function init() {
    if (typeof RAPIER.init === 'function') {
        await RAPIER.init();
    }

    const { scene, camera, renderer, composer, directionalLight } = setupScene();

    // Physics World setup
    const world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
    const dynamicObjects = []; // Link THREE objects and RAPIER bodies

    // Textures & Environment
    const textures = {
        ground: createCheckerboardTexture(),
        crate: createCrateTexture()
    };

    const worldBuilder = new WorldBuilder(scene, world, dynamicObjects);
    worldBuilder.buildEnvironment(textures);

// Player Physics (Using Character Controller)
const playerBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 5, 5);
const playerBody = world.createRigidBody(playerBodyDesc);
const playerColliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.4); // half-height, radius
const playerCollider = world.createCollider(playerColliderDesc, playerBody);

const characterController = world.createCharacterController(0.01);
characterController.enableAutostep(0.3, 0.3, true); // height, minWidth, includeDynamic
characterController.enableSnapToGround(0.3);


// Player Controller
const playerController = new PlayerController(camera, renderer.domElement);
playerController.setPhysicsBody(playerBody, playerCollider, characterController, world);

// Tools
const physicsGun = new PhysicsGun(camera, scene, world, dynamicObjects);
const weldTool = new WeldTool(camera, scene, world, dynamicObjects);
const thrusterTool = new ThrusterTool(camera, scene, world, dynamicObjects);

let currentTool = 'physgun';
physicsGun.enabled = true;

window.addEventListener('keydown', (e) => {
    if (e.code === 'Digit1') {
        currentTool = 'physgun';
        physicsGun.enabled = true;
        weldTool.enabled = false;
        weldTool.reset();
        thrusterTool.enabled = false;
        console.log("Tool: Physics Gun");
    }
    if (e.code === 'Digit2') {
        currentTool = 'weld';
        physicsGun.enabled = false;
        physicsGun.releaseGrab();
        weldTool.enabled = true;
        thrusterTool.enabled = false;
        console.log("Tool: Weld");
    }
    if (e.code === 'Digit3') {
        currentTool = 'thruster';
        physicsGun.enabled = false;
        physicsGun.releaseGrab();
        weldTool.enabled = false;
        weldTool.reset();
        thrusterTool.enabled = true;
        console.log("Tool: Thruster");
    }
});

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

    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size * 2, size * 2, size * 2),
        new THREE.MeshStandardMaterial({ map: textures.crate, roughness: 0.8 })
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

document.getElementById('spawn-cylinder').addEventListener('click', () => {
    const radius = 0.5 + Math.random() * 0.5;
    const height = 1.0 + Math.random() * 1.0;
    const color = Math.random() * 0xffffff;

    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, height, 32),
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
    const colliderDesc = RAPIER.ColliderDesc.cylinder(height / 2, radius).setMass(radius * height * 10);
    world.createCollider(colliderDesc, body);

    dynamicObjects.push({ mesh, body });
});

document.getElementById('spawn-cone').addEventListener('click', () => {
    const radius = 0.5 + Math.random() * 0.5;
    const height = 1.0 + Math.random() * 1.0;
    const color = Math.random() * 0xffffff;

    const mesh = new THREE.Mesh(
        new THREE.ConeGeometry(radius, height, 32),
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
    const colliderDesc = RAPIER.ColliderDesc.cone(height / 2, radius).setMass(radius * height * 5);
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

document.getElementById('spawn-car').addEventListener('click', () => {
    const spawnPos = getSpawnPosition(6);
    spawnPos.y += 1;

    const vehicle = new Vehicle(scene, world, spawnPos);
    vehicle.bodies.forEach(b => {
        dynamicObjects.push(b);
    });
    console.log("Spawned Car. Use I and K to drive rear wheels.");
});

// UI Tab Logic
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
});

// Resize handled in SceneSetup

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
    physicsGun.update(delta);
    thrusterTool.update();

    // Use composer instead of renderer for post-processing
    composer.render();
}

animate();

} // end of init()

init().catch(console.error);
