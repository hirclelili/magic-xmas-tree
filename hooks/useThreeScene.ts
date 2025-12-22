
import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { InteractionMode, ParticleData, DustData, PhotoData, GestureManager } from '../types';
import { CONFIG } from '../constants';

interface ThreeSceneProps {
    containerRef: React.RefObject<HTMLDivElement>;
    mode: InteractionMode;
    photos: string[];
    gestureManager: GestureManager | null;
    onModeChangeRequest: (mode: InteractionMode) => void;
}

class SceneController {
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;
    private composer: EffectComposer;
    private mainGroup = new THREE.Group();
    private photoGroup = new THREE.Group();
    private clock = new THREE.Clock();
    private particles: ParticleData[] = [];
    private dusts: DustData[] = [];
    private photos: PhotoData[] = [];
    private instancedMeshes: { [key: string]: THREE.InstancedMesh } = {};
    private spiralMesh: THREE.Mesh | null = null;
    private focusTarget: THREE.Group | null = null;
    private state = {
        rotation: { x: 0, y: 0 },
    };
    private dummy = new THREE.Object3D();
    private snowflakeTexture: THREE.CanvasTexture;
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();
    private onModeChangeRequest: (mode: InteractionMode) => void;

    constructor(container: HTMLDivElement, onModeChangeRequest: (mode: InteractionMode) => void) {
        this.onModeChangeRequest = onModeChangeRequest;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
        
        container.appendChild(this.renderer.domElement);
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        this.renderer.toneMappingExposure = 2.0;
        
        this.camera.position.set(0, 2, CONFIG.camera.z);
        this.scene.background = new THREE.Color(CONFIG.colors.bg);
        this.scene.fog = new THREE.FogExp2(CONFIG.colors.bg, 0.015);
        this.scene.add(this.mainGroup);
        this.mainGroup.add(this.photoGroup);

        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(this.renderer), 0.04).texture;
        pmremGenerator.dispose();

        this.addLights();
        
        const renderScene = new RenderPass(this.scene, this.camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.8, 0.85);
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
        this.composer.addPass(bloomPass);
        
        this.snowflakeTexture = this.createSnowflakeTexture();
        this.createInstancedParticles();
        this.createSpiralRibbon();
        this.createInstancedDust();
        this.createDefaultPhotos();

        this.renderer.domElement.addEventListener('click', this.onCanvasClick);
    }

    private onCanvasClick = (event: MouseEvent) => {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const photoIntersects = this.raycaster.intersectObjects(this.photoGroup.children, true);
        if (photoIntersects.length > 0) {
            let clickedObject = photoIntersects[0].object;
            while (clickedObject.parent && clickedObject.parent !== this.photoGroup) {
                clickedObject = clickedObject.parent;
            }
            if (clickedObject !== this.photoGroup) {
                this.focusTarget = clickedObject as THREE.Group;
                this.onModeChangeRequest(InteractionMode.FOCUS);
                return;
            }
        }

        const particleMeshes = Object.keys(this.instancedMeshes)
            .filter(key => key !== 'DUST')
            .map(key => this.instancedMeshes[key]);
        const particleIntersects = this.raycaster.intersectObjects(particleMeshes);

        if (particleIntersects.length > 0) {
            this.onModeChangeRequest(InteractionMode.SCATTER);
            return;
        }

        this.onModeChangeRequest(InteractionMode.TREE);
    };

    private createSnowflakeTexture(): THREE.CanvasTexture {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.translate(32, 32);
        for(let i=0; i<6; i++) {
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(0, -24);
            ctx.moveTo(0, -10); ctx.lineTo(7, -17);
            ctx.moveTo(0, -10); ctx.lineTo(-7, -17);
            ctx.stroke();
            ctx.rotate(Math.PI / 3);
        }
        return new THREE.CanvasTexture(canvas);
    }
    
    private addLights() {
        this.scene.add(new THREE.AmbientLight(0xccddff, 0.4));
        const innerLight = new THREE.PointLight(CONFIG.colors.iceBlue, 2, 25);
        innerLight.position.set(0, 5, 0);
        this.mainGroup.add(innerLight);
        const spotCyan = new THREE.SpotLight(CONFIG.colors.cyan, 1000, 0, 0.6, 0.5);
        spotCyan.position.set(30, 40, 40);
        this.scene.add(spotCyan);
    }

    private createInstancedParticles() {
        const geometries = {
            ICE: new THREE.IcosahedronGeometry(0.4, 0),
            SNOW: new THREE.SphereGeometry(0.4, 8, 8),
            FLAKE: new THREE.PlaneGeometry(0.8, 0.8),
            GLOW: new THREE.IcosahedronGeometry(0.3, 0),
        };
        const materials = {
            ICE: new THREE.MeshPhysicalMaterial({ color: CONFIG.colors.iceBlue, metalness: 0.1, roughness: 0.1, transmission: 0.9, thickness: 1.0, ior: 1.5, envMapIntensity: 2.0, clearcoat: 1.0 }),
            SNOW: new THREE.MeshStandardMaterial({ color: CONFIG.colors.white, metalness: 0.1, roughness: 0.9, emissive: 0x222222 }),
            FLAKE: new THREE.MeshBasicMaterial({ map: this.snowflakeTexture, transparent: true, opacity: 0.9, side: THREE.DoubleSide, color: CONFIG.colors.cyan }),
            GLOW: new THREE.MeshBasicMaterial({ color: CONFIG.colors.cyan, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }),
        };

        const counts = { ICE: 0, SNOW: 0, FLAKE: 0, GLOW: 0 };
        for (let i = 0; i < CONFIG.particles.count; i++) {
            const rand = Math.random();
            if (rand < 0.40) counts.ICE++;
            else if (rand < 0.70) counts.SNOW++;
            else if (rand < 0.90) counts.FLAKE++;
            else counts.GLOW++;
        }
        
        Object.keys(counts).forEach(key => {
            const mesh = new THREE.InstancedMesh(geometries[key as keyof typeof geometries], materials[key as keyof typeof materials], counts[key as keyof typeof counts]);
            this.instancedMeshes[key] = mesh;
            this.mainGroup.add(mesh);
        });

        const currentIndices = { ICE: 0, SNOW: 0, FLAKE: 0, GLOW: 0 };
        for (let i = 0; i < CONFIG.particles.count; i++) {
            const rand = Math.random();
            let type: 'ICE' | 'SNOW' | 'FLAKE' | 'GLOW';
            if (rand < 0.40) type = 'ICE';
            else if (rand < 0.70) type = 'SNOW';
            else if (rand < 0.90) type = 'FLAKE';
            else type = 'GLOW';

            const h = CONFIG.particles.treeHeight;
            let t = Math.pow(Math.random(), 0.8);
            const y = (t * h) - (h / 2);
            let rMax = CONFIG.particles.treeRadius * (1.0 - t) || 0.5;
            const angle = t * 50 * Math.PI + Math.random() * Math.PI;
            const r = rMax * (0.8 + Math.random() * 0.4);
            const posTree = new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);

            let rScatter = 15 + Math.random() * 25;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const posScatter = new THREE.Vector3(rScatter * Math.sin(phi) * Math.cos(theta), rScatter * Math.sin(phi) * Math.sin(theta), rScatter * Math.cos(phi));

            this.particles.push({
                type,
                index: currentIndices[type]++,
                meshRef: this.instancedMeshes[type],
                posTree, posScatter,
                currentPos: posTree.clone(),
                baseScale: 0.4 + Math.random() * 0.5,
                currentScale: 1,
                rotation: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
                spinSpeed: new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5),
                randomPhase: Math.random() * Math.PI * 2
            });
        }
        this.createTopStar();
    }

    private createTopStar() {
        const starPts = [];
        for (let i = 0; i < 12; i++) {
            const r = (i % 2 === 0) ? 1.5 : 0.6;
            const a = (i / 6) * Math.PI;
            starPts.push(new THREE.Vector2(Math.sin(a) * r, Math.cos(a) * r));
        }
        const starGeo = new THREE.ExtrudeGeometry(new THREE.Shape(starPts), { depth: 0.4, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3 });
        starGeo.center();
        const starMat = new THREE.MeshPhysicalMaterial({ color: CONFIG.colors.cyan, emissive: 0x87CEFA, emissiveIntensity: 1.0, metalness: 0.6, roughness: 0.1, transmission: 0.6, thickness: 2.0 });
        const star = new THREE.Mesh(starGeo, starMat);
        star.position.set(0, CONFIG.particles.treeHeight / 2 + 1.2, 0);
        this.mainGroup.add(star);
        const starLight = new THREE.PointLight(CONFIG.colors.cyan, 2, 10);
        starLight.position.copy(star.position);
        this.mainGroup.add(starLight);
    }
    
    private createSpiralRibbon() {
        const points = [];
        const h = CONFIG.particles.treeHeight;
        const rMax = CONFIG.particles.treeRadius + 2.5;
        for (let i = 0; i <= 200; i++) {
            const t = i / 200;
            const angle = t * Math.PI * 2 * 5;
            const y = (t * h) - (h / 2);
            points.push(new THREE.Vector3(Math.cos(angle) * (rMax * (1-t)), y, Math.sin(angle) * (rMax * (1-t))));
        }
        const curve = new THREE.CatmullRomCurve3(points);
        const geometry = new THREE.TubeGeometry(curve, 200, 0.06, 6, false);
        const material = new THREE.MeshBasicMaterial({ color: CONFIG.colors.stream, transparent: true, opacity: 0.95, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
        this.spiralMesh = new THREE.Mesh(geometry, material);
        this.mainGroup.add(this.spiralMesh);
    }

    private createInstancedDust() {
        const geo = new THREE.PlaneGeometry(0.15, 0.15);
        const mat = new THREE.MeshBasicMaterial({ map: this.snowflakeTexture, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
        this.instancedMeshes.DUST = new THREE.InstancedMesh(geo, mat, CONFIG.particles.dustCount);
        this.scene.add(this.instancedMeshes.DUST);

        for (let i = 0; i < CONFIG.particles.dustCount; i++) {
            const rScatter = 30 + Math.random() * 30;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const pos = new THREE.Vector3(rScatter * Math.sin(phi) * Math.cos(theta), rScatter * Math.cos(phi), rScatter * Math.sin(phi) * Math.sin(theta));
            this.dusts.push({ id: i, pos, yOffset: Math.random() * 50 - 25, fallSpeed: 0.5 + Math.random() * 1.5, scale: 0.5 + Math.random() * 0.8, rotation: Math.random() * Math.PI });
        }
    }
    
    public updatePhotos(photoUrls: string[]) {
        while(this.photos.length) {
            const p = this.photos.pop()!;
            this.photoGroup.remove(p.mesh);
        }
        if (photoUrls.length === 0) {
            this.createDefaultPhotos();
        } else {
             const loader = new THREE.TextureLoader();
             photoUrls.forEach(url => {
                 loader.load(url, (texture) => {
                     texture.colorSpace = THREE.SRGBColorSpace;
                     this.addPhotoMesh(texture);
                 });
             });
        }
    }

    private createDefaultPhotos() {
        for (let i = 0; i < CONFIG.photos.count; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 256;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = '#1a1a2a';
            ctx.fillRect(0,0,256,256);
            ctx.strokeStyle = CONFIG.colors.iceBlue.toString(16).padStart(6, '0');
            ctx.lineWidth = 10;
            ctx.strokeRect(10,10,236,236);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px Cinzel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`PHOTO ${i+1}`, 128, 128);
            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            this.addPhotoMesh(texture);
        }
    }

    private addPhotoMesh(texture: THREE.Texture) {
        if(this.photos.length >= CONFIG.photos.count * 2) return; // Cap photos
        const frameMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.silver, metalness: 0.9, roughness: 0.2, envMapIntensity: 1.5, emissive: CONFIG.colors.iceBlue, emissiveIntensity: 0.0 });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 0.05), frameMat);
        const photo = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false }));
        photo.position.z = 0.04;
        const group = new THREE.Group();
        group.add(frame, photo);
        group.scale.setScalar(0.8);
        this.photoGroup.add(group);
        
        const h = CONFIG.particles.treeHeight;
        let t = Math.pow(Math.random(), 0.8);
        const y = (t * h) - (h / 2);
        let rMax = CONFIG.particles.treeRadius * (1.0 - t) || 0.5;
        const angle = Math.random() * Math.PI * 2;
        const r = rMax + 2 + Math.random();
        const posTree = new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);

        let rScatter = 20 + Math.random() * 15;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const posScatter = new THREE.Vector3(rScatter * Math.sin(phi) * Math.cos(theta), rScatter * Math.cos(phi), rScatter * Math.sin(phi) * Math.sin(theta));

        this.photos.push({ mesh: group, posTree, posScatter, baseScale: 0.8, spinSpeed: new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3) });
    }

    public animate(mode: InteractionMode, gestureManager: GestureManager) {
        const dt = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        if (this.spiralMesh) {
            const targetOpacity = (mode === InteractionMode.TREE) ? 0.95 : 0;
            this.spiralMesh.material.opacity = THREE.MathUtils.lerp(this.spiralMesh.material.opacity, targetOpacity, dt * 3);
        }

        const targetCameraZ = (mode === InteractionMode.SCATTER) ? CONFIG.camera.zScatter : CONFIG.camera.z;
        this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCameraZ, dt * 2.0);

        if (mode === InteractionMode.SCATTER && gestureManager.isHandDetected()) {
            const handPos = gestureManager.getHandPosition();
            const targetRotY = handPos.x * Math.PI * 0.9;
            const targetRotX = handPos.y * Math.PI * 0.25;
            this.state.rotation.y = THREE.MathUtils.lerp(this.state.rotation.y, targetRotY, dt * 3);
            this.state.rotation.x = THREE.MathUtils.lerp(this.state.rotation.x, targetRotX, dt * 3);
        } else if (mode === InteractionMode.TREE) {
            this.state.rotation.y += 0.3 * dt;
            this.state.rotation.x = THREE.MathUtils.lerp(this.state.rotation.x, 0, dt * 2);
        } else {
            this.state.rotation.y += 0.1 * dt;
        }
        this.mainGroup.rotation.set(this.state.rotation.x, this.state.rotation.y, 0);

        this.particles.forEach(p => {
            const target = (mode === InteractionMode.SCATTER) ? p.posScatter : p.posTree;
            p.currentPos.lerp(target, 2.0 * dt);
            if (mode === InteractionMode.SCATTER) {
                const twinkle = 1.0 + Math.sin(time * 10.0 + p.randomPhase) * 0.4;
                p.currentScale = THREE.MathUtils.lerp(p.currentScale, p.baseScale * twinkle, dt * 10);
                p.rotation.x += p.spinSpeed.x * dt * 3.0;
                p.rotation.y += p.spinSpeed.y * dt * 3.0;
            } else {
                p.currentScale = THREE.MathUtils.lerp(p.currentScale, p.baseScale, dt * 5);
                p.rotation.x += p.spinSpeed.x * dt;
                p.rotation.y += p.spinSpeed.y * dt;
            }
            this.dummy.position.copy(p.currentPos);
            this.dummy.rotation.copy(p.rotation);
            this.dummy.scale.setScalar(p.currentScale);
            this.dummy.updateMatrix();
            p.meshRef.setMatrixAt(p.index, this.dummy.matrix);
        });
        Object.values(this.instancedMeshes).forEach(m => m.instanceMatrix.needsUpdate = true);

        if (mode !== InteractionMode.FOCUS) {
            this.focusTarget = null;
        }
        
        this.photos.forEach(p => {
            const frameMesh = p.mesh.children[0] as THREE.Mesh<any, THREE.MeshStandardMaterial>;
            if (mode === InteractionMode.FOCUS && p.mesh === this.focusTarget) {
                frameMesh.material.emissiveIntensity = THREE.MathUtils.lerp(frameMesh.material.emissiveIntensity, 0.8, dt * 5);
                const invMatrix = this.mainGroup.matrixWorld.clone().invert();
                const targetPos = new THREE.Vector3(0, 2, CONFIG.camera.z - 10).applyMatrix4(invMatrix);
                p.mesh.position.lerp(targetPos, 5.0 * dt);
                
                const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(
                    new THREE.Matrix4().lookAt(p.mesh.position, this.camera.position, this.camera.up)
                );
                p.mesh.quaternion.slerp(targetQuaternion, 5.0 * dt);

                p.mesh.scale.lerp(new THREE.Vector3(3.6, 3.6, 3.6), 4 * dt);
            } else {
                frameMesh.material.emissiveIntensity = THREE.MathUtils.lerp(frameMesh.material.emissiveIntensity, 0.0, dt * 5);
                const target = (mode === InteractionMode.TREE) ? p.posTree : p.posScatter;
                p.mesh.position.lerp(target, 2.0 * dt);
                p.mesh.rotation.x = THREE.MathUtils.lerp(p.mesh.rotation.x, 0, dt);
                p.mesh.quaternion.slerp(new THREE.Quaternion(), 2.0 * dt);
                const s = (mode === InteractionMode.SCATTER) ? 2.5 : p.baseScale;
                p.mesh.scale.lerp(new THREE.Vector3(s, s, s), 4 * dt);
            }
        });

        this.dusts.forEach(d => {
            d.yOffset -= d.fallSpeed * dt;
            if (d.yOffset < -50) d.yOffset = 50;
            this.dummy.position.set(d.pos.x, d.pos.y + d.yOffset, d.pos.z);
            d.rotation += dt * 0.2;
            this.dummy.rotation.set(0, d.rotation, 0);
            this.dummy.scale.setScalar(d.scale);
            this.dummy.updateMatrix();
            this.instancedMeshes.DUST.setMatrixAt(d.id, this.dummy.matrix);
        });

        this.composer.render();
    }
    
    public resize(width: number, height: number) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
    }

    public dispose() {
        this.renderer.domElement.removeEventListener('click', this.onCanvasClick);
        // Additional cleanup for geometries, materials, textures can be added here
    }
}


export const useThreeScene = ({ containerRef, mode, photos, gestureManager, onModeChangeRequest }: ThreeSceneProps) => {
    const sceneControllerRef = useRef<SceneController | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        
        const controller = new SceneController(containerRef.current, onModeChangeRequest);
        sceneControllerRef.current = controller;

        const onResize = () => {
            if (containerRef.current) {
                controller.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
            }
        };
        window.addEventListener('resize', onResize);

        let animationFrameId: number;
        const animateLoop = () => {
            if(gestureManager) {
                controller.animate(mode, gestureManager);
            }
            animationFrameId = requestAnimationFrame(animateLoop);
        };
        animateLoop();

        return () => {
            window.removeEventListener('resize', onResize);
            cancelAnimationFrame(animationFrameId);
            controller.dispose();
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [containerRef, gestureManager, onModeChangeRequest]);
    
    useEffect(() => {
        if(sceneControllerRef.current && photos.length > 0) {
            sceneControllerRef.current.updatePhotos(photos);
        }
    }, [photos]);

    return { sceneManager: sceneControllerRef.current };
};