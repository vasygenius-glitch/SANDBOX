import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';

export class Vehicle {
    constructor(scene, world, position) {
        this.scene = scene;
        this.world = world;

        this.bodies = [];
        this.joints = [];

        this.build(position);
    }

    createBodyPart(width, height, depth, mass, pos, color) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6, metalness: 0.4 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setCcdEnabled(true);
        const body = this.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2).setMass(mass);
        this.world.createCollider(colliderDesc, body);

        this.bodies.push({ mesh, body });
        return body;
    }

    createWheel(radius, width, mass, pos) {
        const geometry = new THREE.CylinderGeometry(radius, radius, width, 16);
        // Rotate cylinder to face X axis (wheels role along Z)
        geometry.rotateZ(Math.PI / 2);

        const material = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setCcdEnabled(true);
        const body = this.world.createRigidBody(bodyDesc);

        // Use cylinder collider rotated to match mesh
        const colliderDesc = RAPIER.ColliderDesc.cylinder(width / 2, radius).setMass(mass);
        colliderDesc.setRotation({x: 0, y: 0, z: Math.sin(Math.PI/4), w: Math.cos(Math.PI/4)}); // 90 deg around Z
        this.world.createCollider(colliderDesc, body);

        this.bodies.push({ mesh, body });
        return body;
    }

    build(pos) {
        // Chassis
        const chassisWidth = 2.0;
        const chassisHeight = 0.5;
        const chassisLength = 4.0;
        const chassisY = pos.y + 1.0;
        const chassis = this.createBodyPart(chassisWidth, chassisHeight, chassisLength, 150.0, { x: pos.x, y: chassisY, z: pos.z }, 0xcc2222);

        // Wheels
        const wheelRadius = 0.5;
        const wheelWidth = 0.4;
        const wheelMass = 20.0;
        const wheelOffsetZ = chassisLength / 2 - 0.5;
        const wheelOffsetX = chassisWidth / 2 + wheelWidth / 2 + 0.1;
        const wheelY = chassisY - chassisHeight / 2;

        const wFL = this.createWheel(wheelRadius, wheelWidth, wheelMass, { x: pos.x - wheelOffsetX, y: wheelY, z: pos.z + wheelOffsetZ });
        const wFR = this.createWheel(wheelRadius, wheelWidth, wheelMass, { x: pos.x + wheelOffsetX, y: wheelY, z: pos.z + wheelOffsetZ });
        const wRL = this.createWheel(wheelRadius, wheelWidth, wheelMass, { x: pos.x - wheelOffsetX, y: wheelY, z: pos.z - wheelOffsetZ });
        const wRR = this.createWheel(wheelRadius, wheelWidth, wheelMass, { x: pos.x + wheelOffsetX, y: wheelY, z: pos.z - wheelOffsetZ });

        // Joints
        // We use revolute joints (hinges) for the wheels, rotating around the local X axis
        const axis1 = { x: 1, y: 0, z: 0 };
        const axis2 = { x: 1, y: 0, z: 0 };

        // Front Left
        const jFL = this.world.createImpulseJoint(
            RAPIER.JointData.revolute({ x: -wheelOffsetX, y: -chassisHeight/2, z: wheelOffsetZ }, { x: 0, y: 0, z: 0 }, axis1, axis2),
            chassis, wFL, true
        );
        // Front Right
        const jFR = this.world.createImpulseJoint(
            RAPIER.JointData.revolute({ x: wheelOffsetX, y: -chassisHeight/2, z: wheelOffsetZ }, { x: 0, y: 0, z: 0 }, axis1, axis2),
            chassis, wFR, true
        );
        // Rear Left
        const jRL = this.world.createImpulseJoint(
            RAPIER.JointData.revolute({ x: -wheelOffsetX, y: -chassisHeight/2, z: -wheelOffsetZ }, { x: 0, y: 0, z: 0 }, axis1, axis2),
            chassis, wRL, true
        );
        // Rear Right
        const jRR = this.world.createImpulseJoint(
            RAPIER.JointData.revolute({ x: wheelOffsetX, y: -chassisHeight/2, z: -wheelOffsetZ }, { x: 0, y: 0, z: 0 }, axis1, axis2),
            chassis, wRR, true
        );

        this.joints.push(jFL, jFR, jRL, jRR);

        // Simple input to drive rear wheels
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyI') {
                wRL.applyTorqueImpulse({x: -50, y: 0, z: 0}, true);
                wRR.applyTorqueImpulse({x: -50, y: 0, z: 0}, true);
            }
            if (e.code === 'KeyK') {
                wRL.applyTorqueImpulse({x: 50, y: 0, z: 0}, true);
                wRR.applyTorqueImpulse({x: 50, y: 0, z: 0}, true);
            }
        });
    }
}
