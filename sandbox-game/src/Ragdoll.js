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

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z);
        const body = this.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2).setMass(mass);
        this.world.createCollider(colliderDesc, body);

        this.bodies.push({ mesh, body });

        return body;
    }

    createJoint(parent, child, anchor1, anchor2) {
        // limit the joints slightly so the ragdoll isn't completely spaghetti
        const jointData = RAPIER.JointData.spherical(anchor1, anchor2);
        const joint = this.world.createImpulseJoint(jointData, parent, child, true);
        this.joints.push(joint);
        return joint;
    }

    build(pos) {
        const hOffset = pos.y; // base spawn height

        // 1. Torso
        const torso = this.createLimb(0.6, 1.0, 0.4, 10.0, { x: pos.x, y: hOffset + 1.5, z: pos.z });

        // 2. Head
        const head = this.createLimb(0.4, 0.4, 0.4, 3.0, { x: pos.x, y: hOffset + 2.3, z: pos.z });

        // 3. Arms
        const leftArm = this.createLimb(0.2, 0.8, 0.2, 2.0, { x: pos.x - 0.5, y: hOffset + 1.5, z: pos.z });
        const rightArm = this.createLimb(0.2, 0.8, 0.2, 2.0, { x: pos.x + 0.5, y: hOffset + 1.5, z: pos.z });

        // 4. Legs
        const leftLeg = this.createLimb(0.25, 1.0, 0.25, 4.0, { x: pos.x - 0.2, y: hOffset + 0.5, z: pos.z });
        const rightLeg = this.createLimb(0.25, 1.0, 0.25, 4.0, { x: pos.x + 0.2, y: hOffset + 0.5, z: pos.z });

        // Link them with joints

        // Head to Torso
        this.createJoint(torso, head, { x: 0, y: 0.5, z: 0 }, { x: 0, y: -0.2, z: 0 });

        // Arms to Torso
        this.createJoint(torso, leftArm, { x: -0.3, y: 0.4, z: 0 }, { x: 0, y: 0.4, z: 0 });
        this.createJoint(torso, rightArm, { x: 0.3, y: 0.4, z: 0 }, { x: 0, y: 0.4, z: 0 });

        // Legs to Torso
        this.createJoint(torso, leftLeg, { x: -0.15, y: -0.5, z: 0 }, { x: 0, y: 0.5, z: 0 });
        this.createJoint(torso, rightLeg, { x: 0.15, y: -0.5, z: 0 }, { x: 0, y: 0.5, z: 0 });
    }
}
