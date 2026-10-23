import { createScene, DURATION, PREVIEW_TIME, PALETTES } from './src/scene.js';

const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const play = document.getElementById('play');
const restart = document.getElementById('restart');
const theme = document.getElementById('theme');
const timeline = document.getElementById('timeline');
const timeLabel = document.getElementById('time');
const status = document.getElementById('status');
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const scene = createScene();
let seconds = PREVIEW_TIME;
let poster = true;
let playing = false;
let origin = 0;
let animation = 0;
let lastFrame = 0;

function palette() {
  const dark = theme.value === 'dark' || theme.value === 'auto' && systemTheme.matches;
  return PALETTES[dark ? 'dark' : 'light'];
}

function draw() {
  scene.draw(context, canvas.width, canvas.height, seconds, palette());
  timeline.value = seconds;
  timeLabel.value = `${seconds.toFixed(1)} / ${DURATION} s`;
  timeline.setAttribute('aria-valuetext', timeLabel.value);
  status.textContent = scene.describe(seconds);
}

function resize() {
  const box = canvas.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(box.width * ratio));
  canvas.height = Math.max(1, Math.round(box.height * ratio));
  draw();
}

function updateButton() {
  play.textContent = playing ? 'Pause' : poster || seconds >= DURATION ? 'Play' : 'Resume';
  play.setAttribute('aria-pressed', String(playing));
}

function pause() {
  if (playing) seconds = Math.min(DURATION, (performance.now() - origin) / 1000);
  playing = false;
  cancelAnimationFrame(animation);
  updateButton();
}

function tick(now) {
  if (!playing) return;
  seconds = Math.min(DURATION, (now - origin) / 1000);
  if (now - lastFrame >= 1000 / 30 || seconds === DURATION) {
    draw();
    lastFrame = now;
  }
  if (seconds === DURATION) pause();
  else animation = requestAnimationFrame(tick);
}

function start(fromBeginning = false) {
  pause();
  if (fromBeginning || poster || seconds >= DURATION) seconds = 0;
  poster = false;
  playing = true;
  origin = performance.now() - seconds * 1000;
  updateButton();
  draw();
  animation = requestAnimationFrame(tick);
}

play.addEventListener('click', () => {
  if (playing) {
    pause();
    draw();
  } else start();
});
restart.addEventListener('click', () => start(true));
timeline.addEventListener('input', () => {
  pause();
  poster = false;
  seconds = Number(timeline.value);
  updateButton();
  draw();
});
theme.addEventListener('change', () => {
  document.documentElement.dataset.theme = theme.value;
  draw();
});
systemTheme.addEventListener('change', draw);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
window.addEventListener('pagehide', pause);
new ResizeObserver(resize).observe(canvas);
resize();
