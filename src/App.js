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
  MeshPhongMaterial,
  ShaderChunk,
  PlaneBufferGeometry
} from 'three';
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

    // scene
    const detail = 50;
    const scene = new Scene();
    scene.fog = new Fog(0xcce0ff, 5, 100);

    // camera
    const camera = new PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.y = 5;
    camera.position.z = 30;

    scene.add(camera);

    // light
    scene.add(new AmbientLight(0x666666));

    const light = new DirectionalLight(0xdfebff, 1.75);
    light.position.set(2, 8, 4);

    light.castShadow = true;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    light.shadow.camera.far = 20;

    scene.add(light);
    // scene.add(new CameraHelper(light.shadow.camera));

    // ground
    const groundMaterial = new MeshPhongMaterial({ color: 0x404040, specular: 0x111111 });
    const groundMesh = new Mesh(new PlaneBufferGeometry(20000, 20000), groundMaterial);
    groundMesh.rotation.x = - Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // overwrite shadowmap code https://threejs.org/examples/webgl_shadowmap_pcss.html
    let shader = ShaderChunk.shadowmap_pars_fragment;

    shader = shader.replace(
      '#ifdef USE_SHADOWMAP',
      '#ifdef USE_SHADOWMAP' +
      document.getElementById('PCSS').textContent
    );

    shader = shader.replace(
      '#if defined( SHADOWMAP_TYPE_PCF )',
      document.getElementById('PCSSGetShadow').textContent +
      '#if defined( SHADOWMAP_TYPE_PCF )'
    );

    ShaderChunk.shadowmap_pars_fragment = shader;

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

    // renderer
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(scene.fog.color);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    renderer.gammaInput = true;
    renderer.gammaOutput = true;

    renderer.shadowMap.enabled = true;

    // controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enabled = true;
    controls.maxDistance = 1500;
    controls.minDistance = 0;

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

    const params = { meshX: 0, meshY: 3, meshZ: 0, meshSize: 2 };

    const gui = new dat.GUI();

    gui.add(params, 'meshX', -100, 100);
    gui.add(params, 'meshY', -10, 10);
    gui.add(params, 'meshZ', -10, 10);
    gui.add(params, 'meshSize', 0, 2);

    function render() {
      if (normalisedLevel > -34.6) {
        shape = Math.floor(Math.random() * numShapes);
      }

      mesh.rotation.y += .003;
      mesh.position.set(params.meshX, params.meshY, params.meshZ);
      mesh.scale.x = mesh.scale.y = mesh.scale.z = params.meshSize;

      updateGeometry();
      updateAudioLevel();

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
