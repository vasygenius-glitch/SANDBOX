import * as THREE from 'three';

// Procedural textures
export function createCheckerboardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    context.fillStyle = '#6e856e';
    context.fillRect(0, 0, 512, 512);
    context.fillStyle = '#5a7a5a';
    context.fillRect(0, 0, 256, 256);
    context.fillRect(256, 256, 256, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(250, 250);
    return texture;
}

export function createCrateTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = '#8B5A2B'; // Wood base
    context.fillRect(0, 0, 256, 256);
    context.fillStyle = '#6e4420'; // Wood border
    context.fillRect(0, 0, 256, 20);
    context.fillRect(0, 236, 256, 20);
    context.fillRect(0, 0, 20, 256);
    context.fillRect(236, 0, 20, 256);
    // Draw cross
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(256, 256);
    context.moveTo(256, 0);
    context.lineTo(0, 256);
    context.lineWidth = 15;
    context.strokeStyle = '#6e4420';
    context.stroke();
    return new THREE.CanvasTexture(canvas);
}
