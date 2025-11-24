const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WORLD = {
  width: 2200,
  height: 720,
  gravity: 2200,
};

const INPUT = {
  left: false,
  right: false,
  jump: false,
  sprint: false,
  frost: false,
};

window.addEventListener("keydown", (e) => {
  switch (e.key.toLowerCase()) {
    case "a":
    case "arrowleft":
      INPUT.left = true;
      break;
    case "d":
    case "arrowright":
      INPUT.right = true;
      break;
    case "w":
    case "arrowup":
    case " ":
      INPUT.jump = true;
      break;
    case "shift":
      INPUT.sprint = true;
      break;
    case "f":
      INPUT.frost = true;
      break;
  }
});

window.addEventListener("keyup", (e) => {
  switch (e.key.toLowerCase()) {
    case "a":
    case "arrowleft":
      INPUT.left = false;
      break;
    case "d":
    case "arrowright":
      INPUT.right = false;
      break;
    case "w":
    case "arrowup":
    case " ":
      INPUT.jump = false;
      break;
    case "shift":
      INPUT.sprint = false;
      break;
    case "f":
      INPUT.frost = false;
      break;
  }
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

class Rect {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  intersects(other) {
    return !(
      this.x + this.w <= other.x ||
      this.x >= other.x + other.w ||
      this.y + this.h <= other.y ||
      this.y >= other.y + other.h
    );
  }
}

class Player extends Rect {
  constructor(x, y) {
    super(x, y, 46, 58);
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.breathCooldown = 0;
    this.breathActive = 0;
    this.frostMeter = 100;
    this.score = 0;
  }

  update(dt, level) {
    const moveAccel = INPUT.sprint ? 1100 : 900;
    const maxSpeed = INPUT.sprint ? 360 : 280;
    const jumpSpeed = 900;

    // Horizontal control
    let target = 0;
    if (INPUT.left) target -= 1;
    if (INPUT.right) target += 1;
    if (target !== 0) this.facing = target;

    this.vx += target * moveAccel * dt;
    this.vx *= target === 0 ? 0.86 : 0.93;
    this.vx = clamp(this.vx, -maxSpeed, maxSpeed);

    // Jump buffering and coyote time
    if (INPUT.jump) this.jumpBuffer = 0.12;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyote = this.onGround ? 0.12 : Math.max(0, this.coyote - dt);

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -jumpSpeed;
      this.jumpBuffer = 0;
      this.onGround = false;
    }

    // Gravity
    this.vy += WORLD.gravity * dt;
    this.vy = Math.min(this.vy, 1200);

    // Integrate
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.onGround = false;

    this.resolveCollisions(level.platforms);
    this.handleBreath(dt, level.enemies);
  }

  resolveCollisions(platforms) {
    for (const p of platforms) {
      const intersection = this.intersectionDepth(p);
      if (!intersection) continue;

      if (Math.abs(intersection.x) < Math.abs(intersection.y)) {
        this.x += intersection.x;
        this.vx = 0;
      } else {
        this.y += intersection.y;
        this.vy = 0;
        if (intersection.y < 0) {
          this.onGround = true;
          this.coyote = 0.12;
        }
      }
    }
    this.x = clamp(this.x, 0, WORLD.width - this.w);
    this.y = Math.min(this.y, WORLD.height - this.h);
  }

  intersectionDepth(rect) {
    const halfW = (this.w + rect.w) / 2;
    const halfH = (this.h + rect.h) / 2;
    const centerA = { x: this.x + this.w / 2, y: this.y + this.h / 2 };
    const centerB = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    const dx = centerA.x - centerB.x;
    const dy = centerA.y - centerB.y;
    if (Math.abs(dx) > halfW || Math.abs(dy) > halfH) return null;
    const depthX = dx > 0 ? halfW - dx : -halfW - dx;
    const depthY = dy > 0 ? halfH - dy : -halfH - dy;
    return { x: depthX, y: depthY };
  }

  handleBreath(dt, enemies) {
    if (this.breathCooldown > 0) this.breathCooldown -= dt;
    if (this.breathActive > 0) this.breathActive -= dt;

    if (INPUT.frost && this.breathCooldown <= 0 && this.frostMeter > 0) {
      this.breathActive = 0.32;
      this.breathCooldown = 0.6;
    }

    if (this.breathActive > 0) {
      this.frostMeter = clamp(this.frostMeter - 38 * dt, 0, 100);
      const reach = 120;
      const cone = new Rect(
        this.facing > 0 ? this.x + this.w : this.x - reach,
        this.y + 6,
        reach,
        this.h - 12
      );
      for (const enemy of enemies) {
        if (enemy.state === "frozen") continue;
        if (cone.intersects(enemy)) {
          enemy.freeze();
        }
      }
    } else {
      this.frostMeter = clamp(this.frostMeter + 16 * dt, 0, 100);
    }
  }

  render(ctx, camera) {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    const bodyX = this.x;
    const bodyY = this.y;
    const faceOffset = this.facing > 0 ? 14 : 6;

    ctx.fillStyle = "#f7fbff";
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    roundRect(ctx, bodyX, bodyY, this.w, this.h, 14, true, true);

    // Eyes
    ctx.fillStyle = "#0f2d46";
    ctx.beginPath();
    ctx.ellipse(bodyX + faceOffset, bodyY + 22, 5, 7, 0, 0, Math.PI * 2);
    ctx.ellipse(bodyX + faceOffset + 12, bodyY + 22, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = "#d62828";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(bodyX + faceOffset + 6, bodyY + 30, 10, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Thumb-up patch
    ctx.fillStyle = "#ffba08";
    ctx.fillRect(bodyX + 12, bodyY + this.h - 14, 20, 6);

    // Frost breath visual
    if (this.breathActive > 0) {
      const alpha = 0.4 + 0.4 * Math.sin(Date.now() * 0.02);
      const coneX = this.facing > 0 ? this.x + this.w : this.x - 120;
      const grd = ctx.createLinearGradient(coneX, bodyY + 10, coneX + 120 * this.facing, bodyY + 10);
      grd.addColorStop(0, `rgba(138, 225, 255, ${alpha})`);
      grd.addColorStop(1, `rgba(138, 225, 255, 0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(coneX, bodyY + 12);
      ctx.lineTo(coneX + 120 * this.facing, bodyY + 0);
      ctx.lineTo(coneX + 120 * this.facing, bodyY + this.h - 10);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}

class Enemy extends Rect {
  constructor(x, y) {
    super(x, y, 44, 32);
    this.vx = 80;
    this.state = "walk"; // walk | frozen
    this.frozenTimer = 0;
  }

  update(dt, level) {
    if (this.state === "frozen") {
      this.frozenTimer -= dt;
      if (this.frozenTimer <= 0) {
        this.state = "walk";
      }
      return;
    }

    this.x += this.vx * dt;

    // Turn on edges
    const platformBelow = level.platforms.find((p) =>
      this.x + this.w / 2 >= p.x &&
      this.x + this.w / 2 <= p.x + p.w &&
      Math.abs(p.y - (this.y + this.h)) < 2
    );
    if (!platformBelow) this.vx *= -1;

    // Wall collisions
    for (const p of level.platforms) {
      if (!this.intersects(p)) continue;
      if (this.vx > 0) this.x = p.x - this.w;
      else this.x = p.x + p.w;
      this.vx *= -1;
    }

    this.x = clamp(this.x, 0, WORLD.width - this.w);
  }

  freeze() {
    this.state = "frozen";
    this.frozenTimer = 5;
  }

  render(ctx, camera) {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    if (this.state === "frozen") {
      ctx.fillStyle = "rgba(138, 225, 255, 0.75)";
      roundRect(ctx, this.x - 4, this.y - 4, this.w + 8, this.h + 8, 8, true, false);
    }

    ctx.fillStyle = this.state === "frozen" ? "#b2e9ff" : "#e53935";
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    roundRect(ctx, this.x, this.y, this.w, this.h, 8, true, true);

    // Eyes and mouth
    ctx.fillStyle = "#0b0b0b";
    ctx.beginPath();
    ctx.arc(this.x + 14, this.y + 12, 3, 0, Math.PI * 2);
    ctx.arc(this.x + 28, this.y + 12, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#350404";
    ctx.beginPath();
    ctx.moveTo(this.x + 12, this.y + 24);
    ctx.lineTo(this.x + 32, this.y + 24);
    ctx.stroke();

    ctx.restore();
  }
}

class Collectible extends Rect {
  constructor(x, y) {
    super(x, y, 32, 30);
    this.bob = Math.random() * Math.PI * 2;
    this.collected = false;
  }

  update(dt) {
    this.bob += dt * 2;
  }

  render(ctx, camera) {
    if (this.collected) return;
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    const yOffset = Math.sin(this.bob) * 4;
    ctx.fillStyle = "#ffba08";
    ctx.strokeStyle = "rgba(0,0,0,0.14)";
    roundRect(ctx, this.x, this.y + yOffset, this.w, this.h, 8, true, true);
    ctx.fillStyle = "#5c2e00";
    ctx.fillRect(this.x + 6, this.y + yOffset + 10, this.w - 12, 6);
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function createLevel() {
  const platforms = [
    new Rect(0, 480, 640, 40),
    new Rect(740, 480, 360, 40),
    new Rect(1200, 440, 260, 40),
    new Rect(1540, 520, 340, 40),
    new Rect(1960, 480, 240, 40),
    new Rect(420, 370, 160, 26),
    new Rect(900, 340, 180, 26),
    new Rect(1280, 300, 220, 26),
    new Rect(1740, 320, 150, 26),
    new Rect(1020, 260, 90, 22),
  ];

  const enemies = [new Enemy(520, 448), new Enemy(820, 448), new Enemy(1620, 488)];

  const burgers = [
    new Collectible(460, 332),
    new Collectible(940, 300),
    new Collectible(1320, 260),
    new Collectible(1760, 282),
    new Collectible(2050, 440),
  ];

  return { platforms, enemies, burgers };
}

const level = createLevel();
const player = new Player(80, 380);
let lastTime = 0;
const camera = { x: 0, y: 0 };

function updateCamera() {
  const target = clamp(player.x + player.w / 2 - canvas.width / 2, 0, WORLD.width - canvas.width);
  camera.x += (target - camera.x) * 0.12;
  camera.y = 0;
}

function handleCollectibles() {
  for (const burger of level.burgers) {
    if (!burger.collected && player.intersects(burger)) {
      burger.collected = true;
      player.score += 50;
    }
  }
}

function handleEnemyContact() {
  for (const enemy of level.enemies) {
    if (enemy.state === "frozen") continue;
    if (player.intersects(enemy)) {
      // Simple knockback and penalty
      player.vx = -220 * player.facing;
      player.vy = -520;
      player.frostMeter = Math.max(0, player.frostMeter - 18);
    }
  }
}

function renderBackground() {
  ctx.fillStyle = "#0b1c28";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-camera.x * 0.4, 0);
  for (let i = 0; i < 12; i++) {
    const x = i * 200;
    ctx.fillStyle = "rgba(255, 186, 8, 0.08)";
    ctx.fillRect(x, 120, 140, 26);
    ctx.fillStyle = "rgba(229, 57, 53, 0.08)";
    ctx.fillRect(x + 60, 180, 120, 18);
  }
  ctx.restore();
}

function renderPlatforms() {
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  for (const p of level.platforms) {
    ctx.fillStyle = "#2b3c4a";
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, p.x, p.y, p.w, p.h, 10, true, true);
    ctx.fillStyle = "rgba(255, 186, 8, 0.22)";
    ctx.fillRect(p.x + 6, p.y + 6, p.w - 12, 8);
  }
  ctx.restore();
}

function renderHUD() {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(12, 12, 180, 70);
  ctx.fillStyle = "#fff";
  ctx.font = "14px Inter, sans-serif";
  ctx.fillText(`Бургеры: ${player.score}`, 20, 36);
  ctx.fillText(`Мороз: ${player.frostMeter.toFixed(0)}%`, 20, 58);
  ctx.restore();
}

function step(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.033);
  lastTime = timestamp;

  player.update(dt, level);
  for (const enemy of level.enemies) enemy.update(dt, level);
  for (const burger of level.burgers) burger.update(dt);
  handleCollectibles();
  handleEnemyContact();
  updateCamera();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderBackground();
  renderPlatforms();
  for (const burger of level.burgers) burger.render(ctx, camera);
  for (const enemy of level.enemies) enemy.render(ctx, camera);
  player.render(ctx, camera);
  renderHUD();

  requestAnimationFrame(step);
}

requestAnimationFrame((time) => {
  lastTime = time;
  step(time);
});

