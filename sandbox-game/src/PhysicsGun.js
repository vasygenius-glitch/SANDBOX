import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';

export class PhysicsGun {
    constructor(camera, scene, world, dynamicObjects) {
        this.camera = camera;
        this.scene = scene;
        this.world = world;
        this.dynamicObjects = dynamicObjects;

        this.raycaster = new THREE.Raycaster();
        this.centerCoords = new THREE.Vector2(0, 0); // center of screen

        this.grabbedObject = null;
        this.joint = null;

        // Kinematic rigid body that moves with the camera to hold the grabbed object
        const kinematicDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
        this.kinematicBody = this.world.createRigidBody(kinematicDesc);
        this.grabDistance = 3.0;

        this.initEventListeners();
    }

    initEventListeners() {
        document.addEventListener('mousedown', (event) => {
            if (event.button === 0 && document.pointerLockElement) {
                this.tryGrab();
            }
        });

        document.addEventListener('mouseup', (event) => {
            if (event.button === 0) {
                this.releaseGrab();
            }
        });
    }

    tryGrab() {
        if (this.joint || this.grabbedObject) return;

        this.raycaster.setFromCamera(this.centerCoords, this.camera);

        const meshes = this.dynamicObjects.map(obj => obj.mesh);
        const intersects = this.raycaster.intersectObjects(meshes);

        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const hitDistance = intersects[0].distance;

            if (hitDistance > 10.0) return; // Too far to grab

            const hitObject = this.dynamicObjects.find(obj => obj.mesh === hitMesh);
            if (hitObject) {
                this.grabbedObject = hitObject;
                this.grabDistance = hitDistance;

                // Point in world space
                const grabPoint = intersects[0].point;
                this.kinematicBody.setTranslation(grabPoint, true);

                // Anchor point relative to the center of the grabbed body
                const objPos = hitObject.body.translation();
                const anchorOnBody = {
                    x: grabPoint.x - objPos.x,
                    y: grabPoint.y - objPos.y,
                    z: grabPoint.z - objPos.z
                };

                // Use Fixed or Spherical joint
                const jointData = RAPIER.JointData.spherical({ x: 0, y: 0, z: 0 }, anchorOnBody);
                this.joint = this.world.createImpulseJoint(jointData, this.kinematicBody, hitObject.body, true);

                hitObject.body.wakeUp();
            }
        }
    }

    releaseGrab() {
        if (this.joint) {
            this.world.removeImpulseJoint(this.joint, true);
            this.joint = null;
        }

        if (this.grabbedObject) {
            const dir = new THREE.Vector3();
            this.camera.getWorldDirection(dir);
            const mass = this.grabbedObject.body.mass();
            this.grabbedObject.body.applyImpulse(dir.multiplyScalar(mass * 5.0), true);
            this.grabbedObject = null;
        }
    }

    update() {
        if (this.grabbedObject && this.joint) {
            const dir = new THREE.Vector3();
            this.camera.getWorldDirection(dir);
            const targetPos = this.camera.position.clone().add(dir.multiplyScalar(this.grabDistance));

            const currentPos = this.kinematicBody.translation();

            // Add slight lerp for smooth dragging
            const smoothedPos = {
                x: currentPos.x + (targetPos.x - currentPos.x) * 0.5,
                y: currentPos.y + (targetPos.y - currentPos.y) * 0.5,
                z: currentPos.z + (targetPos.z - currentPos.z) * 0.5,
            };

            this.kinematicBody.setTranslation(smoothedPos, true);
            this.grabbedObject.body.wakeUp();
        }
    }
}
