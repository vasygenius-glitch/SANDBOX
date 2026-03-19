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
        this.walkSpeed = 5.0;
        this.runSpeed = 10.0;
        this.speed = this.walkSpeed;
        this.jumpForce = 0.2; // Adjusted for kinematic jumping

        this.verticalVelocity = 0;
        this.gravity = -9.81 * 2; // Extra gravity for snappy jump

        this.isCrouching = false;
        this.baseHeight = 2.0;

        this.initEventListeners();
    }

    setPhysicsBody(body, collider, characterController, world) {
        this.body = body;
        this.collider = collider;
        this.characterController = characterController;
        this.world = world;
    }

    initEventListeners() {
        document.addEventListener('click', () => {
            // Only lock if the Q-menu isn't open (i.e. 'Q' is not held down)
            if (!this.controls.isLocked && !this.qMenuOpen) {
                this.controls.lock();
            }
        });

        this.qMenuOpen = false;
        const qMenu = document.getElementById('q-menu');

        const onKeyDown = (event) => {
            switch (event.code) {
                case 'KeyE':
                    this.isRotatingObject = true;
                    break;
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
                case 'Space':
                    this.jump();
                    break;
                case 'ShiftLeft':
                    this.speed = this.runSpeed;
                    break;
                case 'ControlLeft':
                case 'KeyC':
                    if (!this.isCrouching) {
                        this.isCrouching = true;
                        this.speed = this.walkSpeed * 0.5;
                        this.collider.setHalfHeight(0.2); // Crouch hit box
                    }
                    break;
                case 'KeyQ':
                    if (!this.qMenuOpen) {
                        this.qMenuOpen = true;
                        qMenu.classList.remove('hidden');
                        document.exitPointerLock();
                    }
                    break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'KeyE':
                    this.isRotatingObject = false;
                    break;
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
                case 'ShiftLeft':
                    if (!this.isCrouching) this.speed = this.walkSpeed;
                    break;
                case 'ControlLeft':
                case 'KeyC':
                    this.isCrouching = false;
                    this.speed = this.walkSpeed;
                    this.collider.setHalfHeight(0.5); // Restore hit box
                    break;
                case 'KeyQ':
                    this.qMenuOpen = false;
                    qMenu.classList.add('hidden');
                    // auto re-lock pointer when menu closes
                    this.controls.lock();
                    break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

    }

    jump() {
        if (!this.characterController) return;

        if (this.characterController.computedGrounded()) {
            this.verticalVelocity = this.jumpForce;
        }
    }

    update(delta) {
        if (!this.controls.isLocked || !this.body || !this.characterController) return;

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
        if (moveVector.lengthSq() > 0) moveVector.normalize();

        // Apply gravity to vertical velocity
        this.verticalVelocity += this.gravity * delta;

        // Desired movement for this frame
        const desiredMovement = {
            x: moveVector.x * this.speed * delta,
            y: this.verticalVelocity,
            z: moveVector.z * this.speed * delta
        };

        // Compute collisons
        this.characterController.computeColliderMovement(this.collider, desiredMovement);

        // Apply corrected movement
        const correctedMovement = this.characterController.computedMovement();
        const currentPos = this.body.translation();

        this.body.setNextKinematicTranslation({
            x: currentPos.x + correctedMovement.x,
            y: currentPos.y + correctedMovement.y,
            z: currentPos.z + correctedMovement.z
        });

        // Reset vertical velocity if grounded or hit ceiling
        if (this.characterController.computedGrounded() && this.verticalVelocity < 0) {
            this.verticalVelocity = -0.1; // keep pushing down slightly to stick to ground
        }

        // Sync camera position to physical body
        const pos = this.body.translation();
        const cameraYOffset = this.isCrouching ? 0.3 : 0.8;

        // Smooth crouch camera transition
        this.camera.position.x = pos.x;
        this.camera.position.y += (pos.y + cameraYOffset - this.camera.position.y) * 15.0 * delta;
        this.camera.position.z = pos.z;
    }
}
