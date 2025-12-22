
import * as THREE from 'three';

export enum InteractionMode {
    TREE = 'TREE',
    SCATTER = 'SCATTER',
    FOCUS = 'FOCUS'
}

export interface ParticleData {
    type: 'ICE' | 'SNOW' | 'FLAKE' | 'GLOW';
    index: number;
    meshRef: THREE.InstancedMesh;
    posTree: THREE.Vector3;
    posScatter: THREE.Vector3;
    currentPos: THREE.Vector3;
    baseScale: number;
    currentScale: number;
    rotation: THREE.Euler;
    spinSpeed: THREE.Vector3;
    randomPhase: number;
}

export interface DustData {
    id: number;
    pos: THREE.Vector3;
    yOffset: number;
    fallSpeed: number;
    scale: number;
    rotation: number;
}

export interface PhotoData {
    mesh: THREE.Group;
    posTree: THREE.Vector3;
    posScatter: THREE.Vector3;
    baseScale: number;
    spinSpeed: THREE.Vector3;
}

export interface GestureManager {
    isHandDetected: () => boolean;
    getHandPosition: () => { x: number; y: number };
}
