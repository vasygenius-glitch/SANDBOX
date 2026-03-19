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
        this.minGrabDistance = 1.0;
        this.maxGrabDistance = 15.0;

        // Rotation controls
        this.isRotating = false;
        this.rotateSpeed = 0.05;
        this.targetRotation = new THREE.Quaternion();

        this.initEventListeners();
    }

    initEventListeners() {
        document.addEventListener('wheel', (event) => {
            if (this.grabbedObject) {
                // Adjust grab distance based on scroll wheel
                const scrollDir = Math.sign(event.deltaY);
                this.grabDistance -= scrollDir * 0.5;
                this.grabDistance = Math.max(this.minGrabDistance, Math.min(this.maxGrabDistance, this.grabDistance));
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.code === 'KeyE' && this.grabbedObject) {
                this.isRotating = true;
            }
            if (this.isRotating) {
                const rotAxis = new THREE.Vector3();
                if (event.code === 'ArrowLeft') rotAxis.set(0, 1, 0); // yaw
                if (event.code === 'ArrowRight') rotAxis.set(0, -1, 0);
                if (event.code === 'ArrowUp') rotAxis.set(1, 0, 0); // pitch
                if (event.code === 'ArrowDown') rotAxis.set(-1, 0, 0);

                if (rotAxis.lengthSq() > 0) {
                    const q = new THREE.Quaternion().setFromAxisAngle(rotAxis, this.rotateSpeed);
                    this.targetRotation.premultiply(q);
                }
            }
        });

        document.addEventListener('keyup', (event) => {
            if (event.code === 'KeyE') {
                this.isRotating = false;
            }
        });

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

                // Store initial rotation of the grabbed object
                const initialRot = hitObject.body.rotation();
                this.targetRotation.set(initialRot.x, initialRot.y, initialRot.z, initialRot.w);
                this.kinematicBody.setRotation(this.targetRotation, true);

                // Use FixedJoint so we can control rotation directly
                const jointData = RAPIER.JointData.fixed(
                    { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 },
                    anchorOnBody, { x: 0, y: 0, z: 0, w: 1 }
                );
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

            // Apply rotation (slerp would be better, but instant set works for rigid grab)
            this.kinematicBody.setRotation(this.targetRotation, true);

            this.grabbedObject.body.wakeUp();
        }
    }
}
