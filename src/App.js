import {
  Scene,
  PointLight,
  PerspectiveCamera,
  Vector3,
  ParametricGeometry,
  MeshPhongMaterial,
  Mesh,
  WebGLRenderer,
  MultiplyOperation,
  DoubleSide
} from 'three';

class App {
  init() {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const audio = new Audio();
    audio.src = '08.mp3';
    audio.autoplay = true;
    audio.loop = true;
    document.body.appendChild(audio);

    const analyser = context.createAnalyser();

    const filter = context.createBiquadFilter();
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
    const bufferLength = analyser.frequencyBinCount;
    const timeDomainData = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(timeDomainData);
    let normalisedLevel = 0;

    // visual
    const detail = 40;
    const scene = new Scene();

    // light
    const pointLight = new PointLight(0xFFFFFF);

    pointLight.position.x = 0;
    pointLight.position.y = 0;
    pointLight.position.z = 10;

    scene.add(pointLight);

    // camera
    const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(0, 0, 4);

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
    // const material = new MeshNormalMaterial( { overdraw: 0.5 } );
    const material = new MeshPhongMaterial({
      color: 0xb1d2ef,
      specular: 0xffc0cb,
      combine: MultiplyOperation,
      side: DoubleSide,
      shininess: 50,
      reflectivity: 1.0
    });
    material.transparent = true;
    material.opacity = 0.7;

    // material.emissive = new Color( 0xffc0cb );

    const mesh = new Mesh(geometry, material);
    scene.add(mesh);

    // renderer
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

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
      // todo smooth levels?
    }

    function render() {
      // if (Math.floor(time) % 10 === 0) {
      // if (normalisedLevel > -35 || Math.floor(time) % 100 === 0) {
      if (normalisedLevel > -34.6) {
        shape = Math.floor(Math.random() * numShapes);
        mesh.scale.x = mesh.scale.y = mesh.scale.z = Math.random() + 0.3;
      }

      // mesh.rotation.x+=.01;
      mesh.rotation.y += .005;

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
