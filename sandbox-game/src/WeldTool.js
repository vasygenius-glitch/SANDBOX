import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';

export class WeldTool {
    constructor(camera, scene, world, dynamicObjects) {
        this.camera = camera;
        this.scene = scene;
        this.world = world;
        this.dynamicObjects = dynamicObjects;

        this.raycaster = new THREE.Raycaster();
        this.centerCoords = new THREE.Vector2(0, 0);

        this.firstObject = null;
        this.firstPoint = null;

        this.enabled = false;
        this.initEventListeners();
    }

    initEventListeners() {
        document.addEventListener('mousedown', (event) => {
            if (!this.enabled) return;
            if (event.button === 0 && document.pointerLockElement) {
                this.tryWeld();
            }
        });
    }

    tryWeld() {
        this.raycaster.setFromCamera(this.centerCoords, this.camera);
        const meshes = this.dynamicObjects.map(obj => obj.mesh);
        // We can also weld to ground, so add ground meshes if we have them...
        // For simplicity, let's just weld dynamic objects to dynamic objects right now.
        const intersects = this.raycaster.intersectObjects(meshes);

        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const hitPoint = intersects[0].point;
            const hitObject = this.dynamicObjects.find(obj => obj.mesh === hitMesh);

            if (hitObject) {
                if (!this.firstObject) {
                    // Select first object
                    this.firstObject = hitObject;
                    this.firstPoint = hitPoint;
                    console.log("Weld Tool: Selected first object");
                } else {
                    if (this.firstObject !== hitObject) {
                        // We have two different objects, weld them together

                        // Calculate anchor points relative to each body
                        const pos1 = this.firstObject.body.translation();
                        const rot1 = new THREE.Quaternion().copy(this.firstObject.body.rotation()).invert();
                        const anchor1 = new THREE.Vector3().copy(this.firstPoint).sub(pos1).applyQuaternion(rot1);

                        const pos2 = hitObject.body.translation();
                        const rot2 = new THREE.Quaternion().copy(hitObject.body.rotation()).invert();
                        const anchor2 = new THREE.Vector3().copy(hitPoint).sub(pos2).applyQuaternion(rot2);

                        // Store relative rotations to ensure they don't snap to identity
                        const diffRot = new THREE.Quaternion().copy(this.firstObject.body.rotation()).invert().multiply(new THREE.Quaternion().copy(hitObject.body.rotation()));

                        const jointData = RAPIER.JointData.fixed(
                            { x: anchor1.x, y: anchor1.y, z: anchor1.z }, { x: 0, y: 0, z: 0, w: 1 },
                            { x: anchor2.x, y: anchor2.y, z: anchor2.z }, { x: diffRot.x, y: diffRot.y, z: diffRot.z, w: diffRot.w }
                        );

                        this.world.createImpulseJoint(jointData, this.firstObject.body, hitObject.body, true);

                        this.firstObject.body.wakeUp();
                        hitObject.body.wakeUp();
                        console.log("Weld Tool: Objects welded");
                    }
                    // Reset
                    this.firstObject = null;
                    this.firstPoint = null;
                }
            }
        }
    }

    reset() {
        this.firstObject = null;
        this.firstPoint = null;
    }
}
