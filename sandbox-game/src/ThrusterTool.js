import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';

export class ThrusterTool {
    constructor(camera, scene, world, dynamicObjects) {
        this.camera = camera;
        this.scene = scene;
        this.world = world;
        this.dynamicObjects = dynamicObjects;

        this.raycaster = new THREE.Raycaster();
        this.centerCoords = new THREE.Vector2(0, 0);

        this.thrusters = []; // Array to hold all created thrusters

        this.enabled = false;
        this.initEventListeners();
    }

    initEventListeners() {
        document.addEventListener('mousedown', (event) => {
            if (!this.enabled) return;
            if (event.button === 0 && document.pointerLockElement) {
                this.tryPlaceThruster();
            }
        });

        // Trigger thrusters on Numpad 8 (or KeyT for laptops)
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Numpad8' || event.code === 'KeyT') {
                this.thrusters.forEach(t => t.active = true);
            }
        });

        document.addEventListener('keyup', (event) => {
            if (event.code === 'Numpad8' || event.code === 'KeyT') {
                this.thrusters.forEach(t => t.active = false);
            }
        });
    }

    tryPlaceThruster() {
        this.raycaster.setFromCamera(this.centerCoords, this.camera);
        const meshes = this.dynamicObjects.map(obj => obj.mesh);
        const intersects = this.raycaster.intersectObjects(meshes);

        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const hitPoint = intersects[0].point;
            const hitNormal = intersects[0].face.normal.clone(); // Local normal

            // Transform normal to world space
            const normalMatrix = new THREE.Matrix3().getNormalMatrix(hitMesh.matrixWorld);
            hitNormal.applyMatrix3(normalMatrix).normalize();

            const hitObject = this.dynamicObjects.find(obj => obj.mesh === hitMesh);

            if (hitObject) {
                // Visual representation of thruster (small cylinder)
                const geometry = new THREE.CylinderGeometry(0.2, 0.2, 0.5, 8);
                // Rotate cylinder so its top faces the normal
                geometry.translate(0, 0.25, 0);
                geometry.rotateX(Math.PI / 2);

                const material = new THREE.MeshStandardMaterial({ color: 0xff4400, metalness: 0.8 });
                const thrusterMesh = new THREE.Mesh(geometry, material);

                // Position at hit point
                thrusterMesh.position.copy(hitPoint);

                // Orient thruster along the normal
                const target = hitPoint.clone().add(hitNormal);
                thrusterMesh.lookAt(target);

                this.scene.add(thrusterMesh);

                // Add thruster data
                this.thrusters.push({
                    mesh: thrusterMesh,
                    parentBody: hitObject.body,
                    localAnchor: new THREE.Vector3().copy(hitPoint).sub(hitObject.body.translation()).applyQuaternion(new THREE.Quaternion().copy(hitObject.body.rotation()).invert()),
                    localDirection: hitNormal.clone().negate().applyQuaternion(new THREE.Quaternion().copy(hitObject.body.rotation()).invert()), // Push IN to the face
                    force: 200.0,
                    active: false
                });

                console.log("Thruster Tool: Placed thruster");
            }
        }
    }

    update() {
        this.thrusters.forEach(thruster => {
            if (thruster.active) {
                const rot = new THREE.Quaternion().copy(thruster.parentBody.rotation());
                const pos = thruster.parentBody.translation();

                // Calculate world force direction
                const worldDir = thruster.localDirection.clone().applyQuaternion(rot);
                const worldForce = worldDir.multiplyScalar(thruster.force);

                // Calculate world application point
                const worldAnchor = thruster.localAnchor.clone().applyQuaternion(rot).add(pos);

                thruster.parentBody.applyImpulseAtPoint(worldForce, worldAnchor, true);
            }

            // Sync visual mesh with parent body
            const pRot = new THREE.Quaternion().copy(thruster.parentBody.rotation());
            const pPos = thruster.parentBody.translation();

            const wAnchor = thruster.localAnchor.clone().applyQuaternion(pRot).add(pPos);
            thruster.mesh.position.copy(wAnchor);

            // Re-orient mesh based on updated normal
            const wNormal = thruster.localDirection.clone().negate().applyQuaternion(pRot);
            const target = wAnchor.clone().add(wNormal);
            thruster.mesh.lookAt(target);
        });
    }
}
