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

        // Grabbed point relative to the object's origin
        this.anchorOnBody = { x: 0, y: 0, z: 0 };

        // Visual beam line
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00aaff, linewidth: 2 });
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        this.beamLine = new THREE.Line(lineGeometry, lineMaterial);
        this.beamLine.visible = false;
        this.scene.add(this.beamLine);

        this.enabled = true;
        this.initEventListeners();
    }

    initEventListeners() {
        document.addEventListener('wheel', (event) => {
            if (!this.enabled) return;
            if (this.grabbedObject) {
                // Adjust grab distance based on scroll wheel
                const scrollDir = Math.sign(event.deltaY);
                this.grabDistance -= scrollDir * 0.5;
                this.grabDistance = Math.max(this.minGrabDistance, Math.min(this.maxGrabDistance, this.grabDistance));
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.code === 'KeyE' && this.grabbedObject && !this.isRotating) {
                this.isRotating = true;

                // Switch to FixedJoint for rigid rotation
                if (this.joint) this.world.removeImpulseJoint(this.joint, true);

                const currentRot = this.grabbedObject.body.rotation();
                this.targetRotation.set(currentRot.x, currentRot.y, currentRot.z, currentRot.w);
                this.kinematicBody.setRotation(this.targetRotation, true);

                const jointData = RAPIER.JointData.fixed(
                    { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 },
                    this.anchorOnBody, { x: 0, y: 0, z: 0, w: 1 }
                );
                this.joint = this.world.createImpulseJoint(jointData, this.kinematicBody, this.grabbedObject.body, true);
                this.grabbedObject.body.wakeUp();
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
            if (event.code === 'KeyE' && this.grabbedObject && this.isRotating) {
                this.isRotating = false;

                // Switch back to SphericalJoint
                if (this.joint) this.world.removeImpulseJoint(this.joint, true);

                const jointData = RAPIER.JointData.spherical({ x: 0, y: 0, z: 0 }, this.anchorOnBody);
                this.joint = this.world.createImpulseJoint(jointData, this.kinematicBody, this.grabbedObject.body, true);
                this.grabbedObject.body.wakeUp();
            } else if (event.code === 'KeyE') {
                this.isRotating = false;
            }
        });

        document.addEventListener('mousedown', (event) => {
            if (!this.enabled) return;
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

                // Keep the anchor in the object's local space if the object is rotated
                // For simplicity we just take world diff and assume center is good enough for now
                // Actually, a more precise local anchor requires inverse quaternion.
                const rotQ = hitObject.body.rotation();
                const inverseRot = new THREE.Quaternion(rotQ.x, rotQ.y, rotQ.z, rotQ.w).invert();

                const diff = new THREE.Vector3(grabPoint.x - objPos.x, grabPoint.y - objPos.y, grabPoint.z - objPos.z);
                diff.applyQuaternion(inverseRot);

                this.anchorOnBody = { x: diff.x, y: diff.y, z: diff.z };

                // Initially use SphericalJoint (dangles freely)
                const jointData = RAPIER.JointData.spherical({ x: 0, y: 0, z: 0 }, this.anchorOnBody);
                this.joint = this.world.createImpulseJoint(jointData, this.kinematicBody, hitObject.body, true);

                this.isRotating = false;
                this.beamLine.visible = true;

                hitObject.body.wakeUp();
            }
        }
    }

    releaseGrab() {
        this.beamLine.visible = false;
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

    update(delta) {
        if (this.grabbedObject && this.joint) {
            const dir = new THREE.Vector3();
            this.camera.getWorldDirection(dir);
            const targetPos = this.camera.position.clone().add(dir.multiplyScalar(this.grabDistance));

            const currentPos = this.kinematicBody.translation();

            // Use time-scaled interpolation (PID-like smooth damping)
            const smoothing = 1.0 - Math.pow(0.001, delta); // Frame-rate independent lerp
            const smoothedPos = {
                x: currentPos.x + (targetPos.x - currentPos.x) * smoothing * 10,
                y: currentPos.y + (targetPos.y - currentPos.y) * smoothing * 10,
                z: currentPos.z + (targetPos.z - currentPos.z) * smoothing * 10,
            };

            this.kinematicBody.setTranslation(smoothedPos, true);

            if (this.isRotating) {
                // Apply rotation only if E is held (fixed joint active)
                this.kinematicBody.setRotation(this.targetRotation, true);
            }

            // Update visual beam line
            // Start beam slightly right and below center of camera
            const startPos = this.camera.position.clone();
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
            const down = new THREE.Vector3(0, -1, 0).applyQuaternion(this.camera.quaternion);
            startPos.add(right.multiplyScalar(0.3)).add(down.multiplyScalar(0.2));

            // End beam at the anchor point on the grabbed object
            const objPos = this.grabbedObject.body.translation();
            const rotQ = this.grabbedObject.body.rotation();
            const objRot = new THREE.Quaternion(rotQ.x, rotQ.y, rotQ.z, rotQ.w);
            const worldAnchor = new THREE.Vector3(this.anchorOnBody.x, this.anchorOnBody.y, this.anchorOnBody.z).applyQuaternion(objRot).add(objPos);

            const positions = this.beamLine.geometry.attributes.position.array;
            positions[0] = startPos.x; positions[1] = startPos.y; positions[2] = startPos.z;
            positions[3] = worldAnchor.x; positions[4] = worldAnchor.y; positions[5] = worldAnchor.z;
            this.beamLine.geometry.attributes.position.needsUpdate = true;

            this.grabbedObject.body.wakeUp();
        }
    }
}
