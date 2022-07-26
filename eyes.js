const baseObject = document.getElementById("base-eye");
const grid = document.getElementById("grid");
let eyes, eyeCenters;
let eyeDensity = 5;
let numEyesX, numEyesY;
const center = new THREE.Vector2();
const mousePos = new THREE.Vector2();
const PI = Math.PI;
let maxDist;
const maxEyeTravelX = 275;
const maxEyeTravelY = 100;

init();

function init() {
  window.addEventListener("resize", throttled(handleResize));
  window.addEventListener("mousemove", throttled(handleMouseMove));
  handleResize();
}

function handleMouseMove(event) {
  mousePos.set(event.clientX, event.clientY);
  eyes.forEach((eye, i) => {
    const vecToMouse = new THREE.Vector2().subVectors(mousePos, eyeCenters[i]);
    const angle = vecToMouse.angle();
    const dist = mousePos.distanceTo(eyeCenters[i]);
    const distPercent = map(dist, 0, maxDist, 0, 1);
    const clampedMouseX = clamp(vecToMouse.x, maxEyeTravelX * -1, maxEyeTravelX);
    const clampedMouseY = clamp(vecToMouse.y, maxEyeTravelY * -1, maxEyeTravelY);
    const pupilX = map(clampedMouseX, 0, maxEyeTravelX, 0, maxEyeTravelX);
    const pupilY = map(clampedMouseY, 0, maxEyeTravelY, 0, maxEyeTravelY);
    const scale = map(dist, 0, maxDist, 0.5, 1.25);
    
    eye.style.setProperty("--pupil-x", pupilX);
    eye.style.setProperty("--pupil-y", pupilY);
    eye.style.setProperty("--scale", scale);
  });
}

function handleResize() {
  
  // recreate the grid and elements 
  const largeSide = Math.max(innerWidth, innerHeight);
  const size = Math.round(largeSide / eyeDensity);
  numEyesX = Math.ceil(innerWidth / size);
  numEyesY = Math.ceil(innerHeight / size);
  grid.style.setProperty("--num-columns", numEyesX);
  grid.style.setProperty("--num-rows", numEyesY);
  grid.innerHTML = "";
  generateArrowGrid();
  
  center.set(innerWidth * 0.5, innerHeight * 0.5);
  maxDist = center.length() * 2;
  
  // send a fake mouse event to trigger the initial point
  handleMouseMove({clientX: center.x, clientY: center.y});
}

function generateArrowGrid() {
  eyes = [];  
  eyeCenters = [];
  for (let i = 0; i < numEyesX * numEyesY; i += 1) {
    
    // add the eye to the grid
    const newArrow = baseObject.cloneNode(true);
    newArrow.id = `eye-${i}`;
    newArrow.setAttribute("class", "eye");
    grid.appendChild(newArrow);
    eyes.push(newArrow);
    
    // save its center point for use later
    const eyeRect = newArrow.getBoundingClientRect();
    const eyeCenter = new THREE.Vector2(
      eyeRect.left + (newArrow.clientWidth * 0.5),
      eyeRect.top + (newArrow.clientHeight * 0.5),
    );
    eyeCenters.push(eyeCenter);
  }
}

// USEFUL FUNCTIONS
function throttled(fn) {
  let didRequest = false;
  return param => {
    if (!didRequest) {
      requestAnimationFrame(() => {
        fn(param);
        didRequest = false;
      });
      didRequest = true;
    }
  };
}
function map(value, min1, max1, min2, max2) {
  return (value - min1) * (max2 - min2) / (max1 - min1) + min2;
}
function clamp (value, min = 0, max = 1) {
  return value <= min ? min : value >= max ? max : value;
}