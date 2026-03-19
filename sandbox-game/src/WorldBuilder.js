import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';

export class WorldBuilder {
    constructor(scene, world, dynamicObjects) {
        this.scene = scene;
        this.world = world;
        this.dynamicObjects = dynamicObjects;
    }

    createBuilding(w, h, d, x, y, z, color, textures = null) {
        const geometry = new THREE.BoxGeometry(w, h, d);
        let material;
        if (textures) {
             material = new THREE.MeshStandardMaterial({ map: textures.crate, roughness: 0.8 });
        } else {
             material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
        const body = this.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(w/2, h/2, d/2);
        this.world.createCollider(colliderDesc, body);
        return body;
    }

    spawnDynamicProp(geometry, material, colliderDesc, x, y, z) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setCcdEnabled(true);
        const body = this.world.createRigidBody(bodyDesc);
        this.world.createCollider(colliderDesc, body);
        this.dynamicObjects.push({ mesh, body });
        return body;
    }

    buildEnvironment(textures) {
        // Ground
        const groundGeometry = new THREE.PlaneGeometry(1000, 1000); // Expanded map
        const groundMaterial = new THREE.MeshStandardMaterial({ map: textures.ground, roughness: 0.9, metalness: 0.1 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Ground Physics
        const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
        const groundBody = this.world.createRigidBody(groundBodyDesc);
        const groundColliderDesc = RAPIER.ColliderDesc.cuboid(500, 0.1, 500);
        this.world.createCollider(groundColliderDesc, groundBody);

        // Buildings & Structures
        this.createBuilding(40, 20, 2, 0, 10, -40, 0x888888); // back wall
        this.createBuilding(2, 20, 40, -20, 10, -20, 0x888888); // left wall

        // A simple platform with a ramp
        this.createBuilding(20, 1, 20, 30, 5, -20, 0xaa5555); // platform

        // Ramp (Needs rotated rigid body)
        const rampW = 10, rampH = 0.5, rampD = 20;
        const rampMesh = new THREE.Mesh(
            new THREE.BoxGeometry(rampW, rampH, rampD),
            new THREE.MeshStandardMaterial({color: 0x5555aa})
        );
        rampMesh.position.set(15, 2.5, -20);
        rampMesh.rotation.z = Math.PI / 6; // 30 degrees incline
        rampMesh.castShadow = true;
        rampMesh.receiveShadow = true;
        this.scene.add(rampMesh);

        const rampBodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(15, 2.5, -20)
            .setRotation({x: 0, y: 0, z: Math.sin(Math.PI/12), w: Math.cos(Math.PI/12)}); // Half-angle for quaternion

        const rampBody = this.world.createRigidBody(rampBodyDesc);
        this.world.createCollider(RAPIER.ColliderDesc.cuboid(rampW/2, rampH/2, rampD/2), rampBody);


        // Add some dynamic props scattered around
        for (let i = 0; i < 30; i++) {
            const isCrate = Math.random() > 0.5;
            const x = -15 + Math.random() * 30;
            const z = -10 + Math.random() * -20;
            const y = 5 + i * 2.0;

            if (isCrate) {
                this.spawnDynamicProp(
                    new THREE.BoxGeometry(1.5, 1.5, 1.5),
                    new THREE.MeshStandardMaterial({ map: textures.crate, roughness: 0.8 }),
                    RAPIER.ColliderDesc.cuboid(0.75, 0.75, 0.75).setMass(10),
                    x, y, z
                );
            } else {
                this.spawnDynamicProp(
                    new THREE.CylinderGeometry(0.5, 0.5, 1.5, 16),
                    new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.5 }), // Metal barrel
                    RAPIER.ColliderDesc.cylinder(0.75, 0.5).setMass(20),
                    x, y, z
                );
            }
        }
    }
}
