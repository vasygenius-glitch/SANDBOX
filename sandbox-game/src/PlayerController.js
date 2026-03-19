import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

export class PlayerController {
    constructor(camera, domElement) {
        this.camera = camera;
        this.controls = new PointerLockControls(camera, domElement);

        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;

        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.speed = 5.0; // Reduced for physics based movement

        this.initEventListeners();
    }

    setPhysicsBody(body, world) {
        this.body = body;
        this.world = world;
    }

    initEventListeners() {
        document.addEventListener('click', () => {
            if (!this.controls.isLocked) {
                this.controls.lock();
            }
        });

        const onKeyDown = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                    this.moveForward = true;
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                    this.moveLeft = true;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.moveBackward = true;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.moveRight = true;
                    break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                    this.moveForward = false;
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                    this.moveLeft = false;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.moveBackward = false;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.moveRight = false;
                    break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
    }

    update(delta) {
        if (!this.controls.isLocked || !this.body) return;

        // Calculate input direction relative to camera
        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();

        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();

        const cameraRight = new THREE.Vector3();
        cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();

        const moveVector = new THREE.Vector3();
        moveVector.addScaledVector(cameraDirection, this.direction.z);
        moveVector.addScaledVector(cameraRight, -this.direction.x);
        moveVector.normalize();

        // Get current velocity
        const linvel = this.body.linvel();

        // Apply target velocity
        const targetVelocity = new THREE.Vector3(
            moveVector.x * this.speed,
            linvel.y, // keep current vertical velocity (gravity/jumping)
            moveVector.z * this.speed
        );

        // Simple velocity interpolation for smooth movement
        this.body.setLinvel({
            x: linvel.x + (targetVelocity.x - linvel.x) * 10.0 * delta,
            y: linvel.y,
            z: linvel.z + (targetVelocity.z - linvel.z) * 10.0 * delta
        }, true);

        // Sync camera position to physical body
        const pos = this.body.translation();
        this.camera.position.set(pos.x, pos.y + 0.8, pos.z); // Offset camera to "eye level"
    }
}
