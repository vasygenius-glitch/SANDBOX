import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';

export class Ragdoll {
    constructor(scene, world, position) {
        this.scene = scene;
        this.world = world;

        this.bodies = [];
        this.joints = [];

        this.build(position);
    }

    createLimb(width, height, depth, mass, pos) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({ color: 0xe0ac69, roughness: 0.8 }); // skin tone
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        // Enable CCD to stop ragdoll parts phasing through walls/floor
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(pos.x, pos.y, pos.z)
            .setCcdEnabled(true);
        const body = this.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2).setMass(mass);
        this.world.createCollider(colliderDesc, body);

        this.bodies.push({ mesh, body });

        return body;
    }

    createSphericalJoint(parent, child, anchor1, anchor2) {
        // Ball-and-Socket Joint (e.g., shoulders, hips)
        const jointData = RAPIER.JointData.spherical(anchor1, anchor2);
        const joint = this.world.createImpulseJoint(jointData, parent, child, true);
        this.joints.push(joint);
        return joint;
    }

    createRevoluteJoint(parent, child, anchor1, anchor2, axis) {
        // Hinge joint (e.g., elbows, knees)
        const jointData = RAPIER.JointData.revolute(anchor1, anchor2, axis);
        const joint = this.world.createImpulseJoint(jointData, parent, child, true);
        this.joints.push(joint);
        return joint;
    }

    build(pos) {
        const hOffset = pos.y; // base spawn height

        // 1. Torso
        const torso = this.createLimb(0.6, 1.0, 0.4, 15.0, { x: pos.x, y: hOffset + 2.0, z: pos.z });

        // 2. Head
        const head = this.createLimb(0.4, 0.4, 0.4, 4.0, { x: pos.x, y: hOffset + 2.8, z: pos.z });

        // 3. Arms (Upper and Lower)
        const leftArmUpper = this.createLimb(0.2, 0.5, 0.2, 2.0, { x: pos.x - 0.5, y: hOffset + 2.2, z: pos.z });
        const leftArmLower = this.createLimb(0.18, 0.5, 0.18, 1.5, { x: pos.x - 0.5, y: hOffset + 1.6, z: pos.z });

        const rightArmUpper = this.createLimb(0.2, 0.5, 0.2, 2.0, { x: pos.x + 0.5, y: hOffset + 2.2, z: pos.z });
        const rightArmLower = this.createLimb(0.18, 0.5, 0.18, 1.5, { x: pos.x + 0.5, y: hOffset + 1.6, z: pos.z });

        // 4. Legs (Upper and Lower)
        const leftLegUpper = this.createLimb(0.25, 0.6, 0.25, 4.0, { x: pos.x - 0.2, y: hOffset + 1.2, z: pos.z });
        const leftLegLower = this.createLimb(0.2, 0.6, 0.2, 3.0, { x: pos.x - 0.2, y: hOffset + 0.5, z: pos.z });

        const rightLegUpper = this.createLimb(0.25, 0.6, 0.25, 4.0, { x: pos.x + 0.2, y: hOffset + 1.2, z: pos.z });
        const rightLegLower = this.createLimb(0.2, 0.6, 0.2, 3.0, { x: pos.x + 0.2, y: hOffset + 0.5, z: pos.z });

        // Link them with joints

        // Head to Torso (Spherical - Neck)
        this.createSphericalJoint(torso, head, { x: 0, y: 0.55, z: 0 }, { x: 0, y: -0.25, z: 0 });

        // Shoulders to Torso (Spherical)
        this.createSphericalJoint(torso, leftArmUpper, { x: -0.35, y: 0.4, z: 0 }, { x: 0, y: 0.25, z: 0 });
        this.createSphericalJoint(torso, rightArmUpper, { x: 0.35, y: 0.4, z: 0 }, { x: 0, y: 0.25, z: 0 });

        // Elbows (Revolute/Hinge - bends along X axis)
        const elbowAxis = { x: 1.0, y: 0.0, z: 0.0 };
        this.createRevoluteJoint(leftArmUpper, leftArmLower, { x: 0, y: -0.25, z: 0 }, { x: 0, y: 0.25, z: 0 }, elbowAxis);
        this.createRevoluteJoint(rightArmUpper, rightArmLower, { x: 0, y: -0.25, z: 0 }, { x: 0, y: 0.25, z: 0 }, elbowAxis);

        // Hips to Torso (Spherical)
        this.createSphericalJoint(torso, leftLegUpper, { x: -0.15, y: -0.55, z: 0 }, { x: 0, y: 0.3, z: 0 });
        this.createSphericalJoint(torso, rightLegUpper, { x: 0.15, y: -0.55, z: 0 }, { x: 0, y: 0.3, z: 0 });

        // Knees (Revolute/Hinge - bends along X axis)
        const kneeAxis = { x: 1.0, y: 0.0, z: 0.0 };
        this.createRevoluteJoint(leftLegUpper, leftLegLower, { x: 0, y: -0.3, z: 0 }, { x: 0, y: 0.3, z: 0 }, kneeAxis);
        this.createRevoluteJoint(rightLegUpper, rightLegLower, { x: 0, y: -0.3, z: 0 }, { x: 0, y: 0.3, z: 0 }, kneeAxis);
    }
}
