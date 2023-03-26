import * as THREE from 'three';
import {LoadingBar} from "./utils/LoadingBar";

import {RGBELoader} from "three/addons/loaders/RGBELoader";
import hospital_room from "../assets/school.glb"
//import hospital_room from "../assets/hospital-room.glb"
import Stats from "three/addons/libs/stats.module";
import {getGltfLoader} from "./utils/loaderUtils";
import {VRButton} from "./utils/VRButton";
import {XRControllerModelFactory} from "three/addons/webxr/XRControllerModelFactory";
import {CanvasUI} from "./utils/CanvasUI";

import venice_sunset_environment from "../assets/hdr/venice_sunset_1k.hdr"
import questions from "../assets/questions.json"
import atmosSound from "../assets/audio/atmos.mp3"
import introSound from "../assets/audio/audio1/intro.mp3"

// Subtask 1.4. Import questions sounds
import option1 from "../assets/audio/option1.mp3"
import option2 from "../assets/audio/option2.mp3"
import option3 from "../assets/audio/option3.mp3"
import option4 from "../assets/audio/option4.mp3"
import option5 from "../assets/audio/option5.mp3"

const questionSounds = {
    option1: option1,
    option2: option2,
    option3: option3,
    option4: option4,
    option5: option5,
}

import successSound from "../assets/audio/success.mp3"

class App {

    constructor() {
        const container = document.createElement('div');
        document.body.appendChild(container);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);
        this.camera.position.set(0, 1.6, 0);

        this.scene = new THREE.Scene();

        this.dolly = new THREE.Group();
        this.dolly.position.set(0, 0, 2.0);
        this.dolly.add(this.camera);
        this.scene.add(this.dolly);

        const ambient = new THREE.HemisphereLight(0xFFFFFF, 0xAAAAAA, 1);
        this.scene.add(ambient);

        const light = new THREE.DirectionalLight(0xFFFFFF, 3);
        light.position.set(1, 1, 1);
        this.scene.add(light)

        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.physicallyCorrectLights = true;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.setClearColor(0xcccccc);
        container.appendChild(this.renderer.domElement);
        this.setEnvironment();

        this.stats = new Stats();
        container.appendChild(this.stats.dom);

        this.clock = new THREE.Clock();
        this.up = new THREE.Vector3(0, 1, 0);
        this.origin = new THREE.Vector3();
        this.workingMatrix = new THREE.Matrix4();
        this.raycaster = new THREE.Raycaster();

        // create an AudioListener and add it to the camera
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);

        const self = this;

        self.questions = questions;
        self.createUI();

        this.loadingBar = new LoadingBar();

        this.loadRoom();

        window.addEventListener('resize', this.resize.bind(this));
    }

    setEnvironment() {
        const loader = new RGBELoader().setDataType(THREE.HalfFloatType);
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        const self = this;

        loader.load(venice_sunset_environment, (texture) => {
            const envMap = pmremGenerator.fromEquirectangular(texture).texture;
            pmremGenerator.dispose();

            self.scene.environment = envMap;

        }, undefined, (err) => {
            console.error(`An error occurred setting the environment: ${err}`);
        });
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    loadRoom() {
        const loader = getGltfLoader()

        const self = this;

        // Load a glTF resource
        loader.load(
            // resource URL
            hospital_room,
            // called when the resource is loaded
            function (gltf) {

                const room = gltf.scene;
                self.scene.add(room);
                self.room = room;

                // const animation = gltf.animations[1];
                // const details = animation.name.split('|');
                // const patient = room.getObjectByName(details[0]);
                // self.mixer = new THREE.AnimationMixer(patient);
                // const action = self.mixer.clipAction(gltf.animations[1]);
                // action.play();

                self.loadingBar.visible = false;

                self.setupXR();
            },
            // called while loading is progressing
            function (xhr) {
                self.loadingBar.progress = (xhr.loaded / xhr.total);
            },
            // called when loading has errors
            function (error) {
                console.log(`An error happened: ${error}`);
            }
        );
    }

    createUI() {
        const headerHeight = 50;
        const panelHeight = 512;
        const footerHeight = headerHeight;

        const self = this;

        let questionIndex = -1;
        let answerIndex = 0;
        let score = -1;

        function showIntro() {
            self.ui.updateElement("header", "Intro");
            self.ui.updateElement("panel", self.questions.intro);
            self.ui.updateConfig("prev", "display", "none");
            self.ui.updateConfig("next", "display", "none");
            self.playSound(introSound);
            questionIndex = 0;
            answerIndex = -1;

        }

        function showOption() {
            // Subtask 3. Show answer options

            const options = self.questions.questions[questionIndex].options;
            if (answerIndex < 0) answerIndex = 0;
            if (answerIndex >= options.length) answerIndex = options.length - 1;
            let display = (answerIndex > 0) ? "block" : "none";
            self.ui.updateConfig("prev", "display", display);
            display = (answerIndex < (options.length - 1)) ? "block" : "none";
            self.ui.updateConfig("next", "display", display);
            self.ui.updateElement("header", "Select a response");
            self.ui.updateElement("panel", options[answerIndex].text);

        }

        function showQuestion() {
            // Subtask 1.2 Show question slide
            const question = self.questions.questions[questionIndex];
            self.ui.updateElement("header", "Quiz Bot")
            self.ui.updateElement("panel", question.text)
            self.ui.updateConfig("prev", "display", "none");
            self.ui.updateConfig("next", "display", "none");
            self.playSound(questionSounds[`option${questionIndex + 1}`]);

        }

        function showScore() {
            // Subtask 2.2 Prepare show score slide
            self.ui.updateElement("header", "Results")
            self.ui.updateElement("panel", `Your score: ${score}`)
            self.ui.updateConfig("prev", "display", "none")
            self.ui.updateConfig("next", "display", "none")
            self.playSound(successSound)
        }

        function onPrev() {
            answerIndex--;
            showOption();
        }

        function onNext() {
            answerIndex++;
            showOption();
        }

        function onContinue() {
            // Subtask 2.4.b Show intro after score slide
            if (questionIndex < 0) {
                //Coming from intro
                questionIndex = 0;
                showQuestion();
                answerIndex = -1;
                score = 0;
            } else if (answerIndex === -1) {
                //Show first option
                answerIndex = 0;
                showOption();
            } else {
                //Option selected
                const question = self.questions.questions[questionIndex];
                questionIndex = question.options[answerIndex].next;

                // Subtask 2.3 Calculate score
                score += question.options[answerIndex].score ?? 0

                if (questionIndex === -1) {
                    // Subtask 2.4.a Show score after last slide
                    showScore()
                } else {
                    answerIndex = -1;
                    showQuestion();
                }
            }
        }

        const config = {
            renderer: this.renderer,
            panelSize: {width: 0.8, height: 1.3},
            width: 512,
            height: panelHeight,
            opacity: 0.7,
            body: {
                fontFamily: 'Arial',
                fontSize: 30,
                padding: 20,
                backgroundColor: '#000',
                fontColor: '#fff',
                borderRadius: 6,
                border: {width: 2, color: "#fff", style: "solid"},
                opacity: 0.7
            },
            header: {
                type: "text",
                position: {x: 0, y: 0},
                height: headerHeight
            },
            panel: {
                type: "text",
                position: {x: 0, y: headerHeight},
                height: panelHeight - headerHeight - footerHeight,
                backgroundColor: "#ffa",
                fontColor: "#000",
                overflow: "scroll",
                leading: 5
            },
            prev: {
                display: 'none',
                type: "button",
                position: {x: 0, y: panelHeight - footerHeight + 5},
                width: footerHeight,
                height: footerHeight,
                fontColor: "#ff4",
                onSelect: onPrev
            },
            next: {
                display: 'none',
                type: "button",
                position: {x: footerHeight, y: panelHeight - footerHeight + 5},
                width: footerHeight,
                height: footerHeight,
                fontColor: "#ff4",
                onSelect: onNext
            },
            continue: {
                type: "button",
                position: {x: 212, y: panelHeight - footerHeight},
                textAlign: "right",
                width: 300,
                height: footerHeight,
                hover: "#ff0",
                fontColor: "#ff4",
                onSelect: onContinue
            }
        }
        const content = {
            header: "Intro",
            panel: self.questions.intro,
            prev: "<path>m 5 20 l 35 35 l 35 5 z</path>",
            next: "<path>m 35 20 l 5 5 l 5 35 z</path>",
            continue: "Continue"
        }

        const ui = new CanvasUI(content, config);
        ui.mesh.position.set(-0.5, 1.0, -2);
        ui.mesh.rotation.x = -0.2;
        ui.mesh.material.opacity = 0.7;

        this.dolly.add(ui.mesh);

        this.ui = ui;
    }

    playSound(soundName) {
        // Subtask 1.1 Load a sound and set it as the Audio object's buffer
        const sound = this.speech;

        const audioLoader = new THREE.AudioLoader();
        audioLoader.load(soundName, (buffer) =>{
            if (sound.isPlaying)sound.stop();
            sound.setBuffer(buffer);
            sound.setLoop(false)
            sound.setVolume(1.0)
            sound.play();
        });
    }

    setupXR() {
        this.renderer.xr.enabled = true;

        const self = this;

        function onSessionStart() {
            // create a global audio source
            if (self.speech === undefined) {
                const atmos = new THREE.Audio(self.listener);

                // load a sound and set it as the Audio object's buffer
                const audioLoader = new THREE.AudioLoader();
                audioLoader.load(atmosSound, (buffer) => {
                    atmos.setBuffer(buffer);
                    atmos.setLoop(true);
                    atmos.setVolume(0.5);
                    atmos.play();
                });

                self.atmos = atmos;

                self.speech = new THREE.Audio(self.listener);
            } else {
                self.atmos.play();
            }
            self.playSound(introSound);
        }

        function onSessionEnd() {
            if (self.speech && self.speech.isPlaying) self.speech.stop();
            if (self.atmos && self.atmos.isPlaying) self.atmos.pause();
        }

        function onDisconnected(event) {
            const controller = event.target;
            if (controller.children.length > 0) controller.remove(controller.children[0]);
            if (controller === self.controller) {
                self.controller = null;
                self.controllerGrip = null;
            } else {
                self.controller1 = null;
                self.controllerGrip1 = null;
            }
        }

        function onSelect(event) {

            if (self.ui !== undefined) self.ui.select();

        }

        new VRButton(this.renderer, {onSessionStart, onSessionEnd});

        // controller
        this.controller = this.renderer.xr.getController(0);
        this.controller.addEventListener('select', onSelect);
        //this.controller.addEventListener( 'disconnected', onDisconnected );
        this.dolly.add(this.controller);

        const controllerModelFactory = new XRControllerModelFactory();

        this.controllerGrip = this.renderer.xr.getControllerGrip(0);
        this.controllerGrip.add(controllerModelFactory.createControllerModel(this.controllerGrip));
        this.dolly.add(this.controllerGrip);

        // controller
        this.controller1 = this.renderer.xr.getController(1);
        this.controller1.addEventListener('select', onSelect);
        //this.controller.addEventListener( 'disconnected', onDisconnected );
        this.dolly.add(this.controller1);

        this.controllerGrip1 = this.renderer.xr.getControllerGrip(1);
        this.controllerGrip1.add(controllerModelFactory.createControllerModel(this.controllerGrip1));
        this.dolly.add(this.controllerGrip1);

        //
        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);

        const line = new THREE.Line(geometry);
        line.name = 'line';
        line.scale.z = 0;

        this.controller.add(line.clone());
        this.controller1.add(line.clone());

        this.selectPressed = false;

        this.renderer.setAnimationLoop(this.render.bind(this));
    }


    handleController(controller) {
        this.workingMatrix.identity().extractRotation(controller.matrixWorld);

        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.workingMatrix);

        const intersects = this.raycaster.intersectObject(this.ui.mesh);

        if (intersects.length > 0) {
            this.ui.hover(intersects[0].point);
            controller.children[0].scale.z = intersects[0].distance;
        } else {
            this.ui.hover();
            controller.children[0].scale.z = 10;
        }
    }

    render() {
        const dt = this.clock.getDelta();
        if (this.mixer !== undefined) this.mixer.update(dt);
        if (this.renderer.xr.isPresenting) {
            if (this.ui !== undefined) this.ui.update();
            this.handleController(this.controller);
        }
        this.stats.update();
        this.renderer.render(this.scene, this.camera);
    }
}

export {App};
