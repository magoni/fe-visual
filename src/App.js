import {
  Scene,
  DirectionalLight,
  Vector3,
  ParametricGeometry,
  MeshNormalMaterial,
  Mesh,
  WebGLRenderer,
  PerspectiveCamera,
  Fog,
  AmbientLight,
  PlaneBufferGeometry,
  TextureLoader,
  RepeatWrapping,
  CubeCamera,
  LinearMipMapLinearFilter
} from 'three';
import Water from './Water';
import Sky from './Sky';
import OrbitControls from 'orbit-controls-es6';
import * as dat from 'dat.gui';

class App {
  initAudio() {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const audio = new Audio();
    const analyser = context.createAnalyser();
    const filter = context.createBiquadFilter();
    const bufferLength = analyser.frequencyBinCount;
    const timeDomainData = new Uint8Array(bufferLength);
    const normalisedLevel = 0;

    audio.src = '08.mp3';
    audio.autoplay = true;
    audio.loop = true;
    document.body.appendChild(audio);

    filter.type = 'bandpass';
    filter.frequency.value = 4000;
    filter.Q.value = 2;

    window.addEventListener('load', () => {
      const source = context.createMediaElementSource(audio);
      // source -> bandpass filter -> analyser
      source.connect(filter);
      filter.connect(analyser);
      // source audio -> output
      source.connect(context.destination);
    }, false);

    analyser.smoothingTimeConstant = 1;
    analyser.fftSize = 256;
    analyser.getByteTimeDomainData(timeDomainData);
    return { normalisedLevel, analyser, timeDomainData };
  }

  init() {
    let { normalisedLevel, analyser, timeDomainData } = this.initAudio();

    // renderer
    let renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // scene
    const detail = 50;
    const scene = new Scene();

    // camera
    const camera = new PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.y = 5;
    camera.position.z = 30;

    scene.add(camera);

    // light
    scene.add(new AmbientLight(0x666666));

    const light = new DirectionalLight(0xffffff, 0.8);
    scene.add(light);
    // scene.add(new CameraHelper(light.shadow.camera));

    const waterNormals = new TextureLoader().load('textures/waternormals.jpg');
    waterNormals.wrapS = waterNormals.wrapT = RepeatWrapping;

    const waterGeometry = new PlaneBufferGeometry(10000, 10000);
    const water = new Water(
      waterGeometry,
      {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: new TextureLoader().load('textures/waternormals.jpg', function (texture) {
          texture.wrapS = texture.wrapT = RepeatWrapping;
        }),
        alpha: 1,
        sunDirection: light.position.clone().normalize(),
        sunColor: 0xffffff,
        waterColor: 0x001e0f,
        distortionScale: 3.7,
        fog: scene.fog !== undefined
      }
    );
    water.rotation.x = - Math.PI / 2;
    scene.add(water);

    // Skybox
    let sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);

    let uniforms = sky.material.uniforms;
    uniforms.turbidity.value = 10;
    uniforms.rayleigh.value = 2;
    uniforms.luminance.value = 1;
    uniforms.mieCoefficient.value = 0.005;
    uniforms.mieDirectionalG.value = 0.8;

    let parameters = {
      distance: 400,
      inclination: 0.3,
      azimuth: 0.205
    };

    let cubeCamera = new CubeCamera(1, 20000, 256);
    cubeCamera.renderTarget.texture.minFilter = LinearMipMapLinearFilter;

    function updateSun() {
      let theta = Math.PI * (parameters.inclination - 0.5);
      let phi = 2 * Math.PI * (parameters.azimuth - 0.5);
      light.position.x = parameters.distance * Math.cos(phi);
      light.position.y = parameters.distance * Math.sin(phi) * Math.sin(theta);
      light.position.z = parameters.distance * Math.sin(phi) * Math.cos(theta);
      sky.material.uniforms.sunPosition.value = light.position.copy(light.position);
      water.material.uniforms.sunDirection.value.copy(light.position).normalize();
      cubeCamera.update(renderer, scene);
    }

    updateSun();

    // shape
    const time = 1;
    let peakInstantaneousPowerDecibels = 0;

    let shape = 1;
    const numShapes = 6;
    let norm = 1;

    function parafunc(u, t, optionalTarget) {
      const result = optionalTarget || new Vector3();

      const v = 2 * Math.PI * t;
      let x;
      let y;
      let z;

      // x = (t * t + Math.log2(v/5)); //static
      norm = Math.pow(Math.abs(normalisedLevel + 33), 2);

      if (shape === 1) {
        // 1 log wave
        x = Math.cos(Math.sqrt(v) + normalisedLevel);
        y = Math.cos(v * v * 3 * (Math.cos(u / 2) * 0.1));
        z = Math.sin(u) * Math.cos(u * 10);
      } else if (shape === 2) {
        // pretty ribbons
        // x = t * t + Math.sin(time*0.1 + v * v + normalisedLevel);
        // y = Math.cos( v * v * 3 * (Math.cos(u/2) * 0.1) * normalisedLevel/2.0 );
        // z = Math.sin(normalisedLevel*v*v*normalisedLevel); //v1
        // z = Math.cos(u*u)*Math.sin(normalisedLevel*u*u*normalisedLevel); //v2 more 3d
        x = Math.cos(Math.sqrt(v) + 0.01 * normalisedLevel);
        y = Math.cos(v * v * 3 * (Math.cos(u / 2) * 0.1) * (Math.abs(normalisedLevel * 0.1)));
        z = Math.sin(u) * Math.cos(u * 10);
      } else if (shape === 3) {
        x = Math.cos(Math.sin(v * t) * Math.abs(normalisedLevel));
        y = Math.cos(v * Math.cos(v) * 3 * (Math.cos(u / 2) * 0.1) * v);
        z = (Math.sin(time / 10 + normalisedLevel) * 0.10) * 5 * Math.sin(v * v);
      } else if (shape === 4) {
        // 4
        x = Math.sin(v);
        y = Math.cos(u * 3 + (20 * Math.abs(normalisedLevel + 33.0)) * time * 0.0005);
        z = Math.sin(u + normalisedLevel) * Math.cos(u * 10);
      } else {
        // 5
        x = Math.sin(u) * Math.sin(t * (Math.pow(Math.abs(normalisedLevel + 33), 2)));
        y = Math.cos(u + t);
        z = Math.sin(u) * Math.cos(u * 10) * 2 * Math.sin(norm + t);

        // x = Math.sin(v);
        // y = Math.cos(v);
        // z = u;

        // x = u * Math.sin(v);
        // y = u * Math.cos(v);
        // z = u * Math.sin(v);
      }


      return result.set(x, y, z);
    }


    // meshes
    const geometry = new ParametricGeometry(parafunc, detail, detail);
    geometry.dynamic = false;

    const material = new MeshNormalMaterial();
    // TODO why is making material transparent or lights throwing error

    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    scene.add(mesh);

    // controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enabled = true;
    controls.maxDistance = 1500;
    controls.minDistance = 0;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1;

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function updateGeometry() {
      mesh.geometry.dispose();
      mesh.geometry = new ParametricGeometry(parafunc, detail, detail);
    }

    function updateAudioLevel() {
      let peakInstantaneousPower = 0;
      analyser.getByteTimeDomainData(timeDomainData);

      for (let i = 0; i < timeDomainData.length; i++) {
        const power = timeDomainData[i] * 2;
        peakInstantaneousPower = Math.max(power, peakInstantaneousPower);
      }

      peakInstantaneousPowerDecibels = 10 * Math.log10(peakInstantaneousPower);
      normalisedLevel = (peakInstantaneousPowerDecibels - 42.0) * 2;
      // TODO smooth levels?
    }

    const params = { meshX: 0, meshY: 4, meshZ: 0, meshSize: 3 };

    const gui = new dat.GUI();

    let folder = gui.addFolder('Shape');
    folder.add(params, 'meshX', -100, 100);
    folder.add(params, 'meshY', -10, 10);
    folder.add(params, 'meshZ', -10, 10);
    folder.add(params, 'meshSize', 0, 10);

    folder = gui.addFolder('Sky');
    folder.add(parameters, 'inclination', 0, 0.5, 0.0001).onChange(updateSun);
    folder.add(parameters, 'azimuth', 0, 1, 0.0001).onChange(updateSun);

    uniforms = water.material.uniforms;
    folder = gui.addFolder('Water');
    folder.add(uniforms.distortionScale, 'value', 0, 8, 0.1).name('distortionScale');
    folder.add(uniforms.size, 'value', 0.1, 10, 0.1).name('size');
    folder.add(uniforms.alpha, 'value', 0.0, 1, .001).name('alpha');
    folder.open();

    function render() {
      if (normalisedLevel > -34.6) {
        shape = Math.floor(Math.random() * numShapes);
      }

      // mesh.rotation.y += .003;
      mesh.position.set(params.meshX, params.meshY, params.meshZ);
      mesh.scale.x = mesh.scale.y = mesh.scale.z = params.meshSize;

      updateGeometry();
      updateAudioLevel();

      controls.update(); // required as long as autoRotate is on

      water.material.uniforms.time.value += 1.0 / 60.0;

      renderer.render(scene, camera);
    }

    function animate() {
      requestAnimationFrame(animate);
      render();
    }

    animate();
    window.addEventListener('resize', onResize);
  }
}

export default App;
