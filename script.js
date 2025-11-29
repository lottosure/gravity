// Module aliases
const Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Composite = Matter.Composite,
    Events = Matter.Events,
    Bounds = Matter.Bounds;

// Configuration
const width = 600;
const height = 500;
const groundHeight = 60;
const jumperSize = 44;

// Physics Setup
const engine = Engine.create();
const world = engine.world;

// Create Renderer
const render = Render.create({
    element: document.getElementById('canvas-container'),
    engine: engine,
    options: {
        width: width,
        height: height,
        wireframes: false,
        background: 'transparent',
        pixelRatio: window.devicePixelRatio || 1,
        hasBounds: true // Enable bounds for camera
    }
});

// Bodies
// 1. Ground
const ground = Bodies.rectangle(width / 2, height - groundHeight / 2, width, groundHeight, {
    isStatic: true,
    render: { fillStyle: '#2ecc71' } // Default Earth Green
});

// 2. Jumper (Astronaut Hitbox)
const jumper = Bodies.rectangle(width / 2, height - groundHeight - jumperSize / 2, jumperSize, jumperSize, {
    chamfer: { radius: 15 },
    restitution: 0,
    friction: 0.5,
    render: {
        fillStyle: 'transparent', // We will draw custom sprite
        opacity: 0
    }
});

// 3. Walls (Invisible)
const wallLeft = Bodies.rectangle(-10, height / 2, 20, height * 10, { isStatic: true }); // Taller walls
const wallRight = Bodies.rectangle(width + 10, height / 2, 20, height * 10, { isStatic: true });
const ceiling = Bodies.rectangle(width / 2, -5000, width, 50, { isStatic: true }); // Very high ceiling

Composite.add(world, [ground, jumper, wallLeft, wallRight, ceiling]);

// Run the engine
Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// --- Game Logic ---

const gravities = {
    earth: 1.0,
    mars: 0.38,
    moon: 0.16
};

const groundColors = {
    earth: '#2ecc71',
    mars: '#e17055',
    moon: '#95a5a6'
};

const bgStyles = {
    earth: 'var(--earth-bg)',
    mars: 'var(--mars-bg)',
    moon: 'var(--moon-bg)'
};

let currentPlanet = 'earth';
const initialMass = jumper.mass; // Store initial mass
const baseJumpForce = 0.035; // Base force coefficient
let weightMultiplier = 1.0; // 0.5 to 2.0
let jumpPowerMultiplier = 1.0; // 0.5 to 2.0
let isJumping = false;
let maxJumpHeight = 0;
const jumpHistory = []; // Array to store jump records

// Power Gauge State - REMOVED

// Initial Setup
setPlanet('earth');
initializeSliders();

function setPlanet(planet) {
    currentPlanet = planet;
    engine.world.gravity.y = gravities[planet];

    // Update UI Buttons
    document.querySelectorAll('.planet-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.btn-${planet}`).classList.add('active');

    // Update Background
    document.body.style.background = bgStyles[planet];

    // Toggle Stars
    if (planet === 'moon') {
        document.body.classList.add('moon-mode');
    } else {
        document.body.classList.remove('moon-mode');
    }

    // Update Ground Color
    ground.render.fillStyle = groundColors[planet];

    resetJumper();
}

function jump(e) {
    if (e && e.cancelable) e.preventDefault();
    if (isJumping) return;

    // Calculate Force with RANDOMNESS (±5% variance)
    // No power gauge - just base force with multipliers and randomness
    const randomVariance = 0.95 + (Math.random() * 0.1); // 0.95 to 1.05
    const finalForce = baseJumpForce * jumper.mass * jumpPowerMultiplier * randomVariance;

    Body.applyForce(jumper, jumper.position, { x: 0, y: -finalForce });

    isJumping = true;
    maxJumpHeight = 0;

    const btn = document.getElementById('jump-btn');
    btn.disabled = true;
    btn.style.opacity = 0.5;
}

function resetJumper() {
    Body.setVelocity(jumper, { x: 0, y: 0 });
    Body.setAngularVelocity(jumper, 0);
    Body.setPosition(jumper, {
        x: width / 2,
        y: height - groundHeight - jumperSize / 2 - 1
    });
    Body.setAngle(jumper, 0);

    // Reset Camera
    Render.lookAt(render, {
        min: { x: 0, y: 0 },
        max: { x: width, y: height }
    });

    isJumping = false;
    const btn = document.getElementById('jump-btn');
    btn.disabled = false;
    btn.style.opacity = 1;
}

// Update Loop - Power Gauge REMOVED
Events.on(engine, 'afterUpdate', function () {
    const groundSurfaceY = height - groundHeight;
    const jumperBottomY = jumper.position.y + (jumperSize / 2);
    let currentH = groundSurfaceY - jumperBottomY;
    if (currentH < 0) currentH = 0;
    const displayHeight = Math.floor(currentH);

    document.querySelector('.current-height').innerText = `${displayHeight} cm`;

    if (isJumping) {
        if (displayHeight > maxJumpHeight) {
            maxJumpHeight = displayHeight;
        }
        // Landed check
        if (Math.abs(jumper.velocity.y) < 0.1 && Math.abs(currentH) < 2 && jumper.position.y > height / 2) {
            finishJump();
        }
    }

    // --- Aggressive Camera Follow Logic ---
    // Keep the character always visible, especially on moon
    const viewportHeight = render.bounds.max.y - render.bounds.min.y;
    const viewportCenterY = render.bounds.min.y + viewportHeight / 2;

    // Target: keep jumper centered vertically
    let desiredCenterY = jumper.position.y;

    // Only constrain downward: don't show too much below ground
    const maxCenterY = height - viewportHeight / 2;
    if (desiredCenterY > maxCenterY) {
        desiredCenterY = maxCenterY;
    }

    // NO UPWARD CONSTRAINT - let camera follow character anywhere they go!

    // Very aggressive smooth factor for moon and high jumps
    let smoothFactor = 0.15; // Base smooth factor

    if (isJumping) {
        // During jump, follow MUCH more aggressively
        smoothFactor = 0.5; // Start very aggressive

        if (Math.abs(jumper.velocity.y) > 5) smoothFactor = 0.6;
        if (Math.abs(jumper.velocity.y) > 15) smoothFactor = 0.75;
        if (Math.abs(jumper.velocity.y) > 25) smoothFactor = 0.9;

        // Extra aggressive on moon due to very high jumps
        if (currentPlanet === 'moon') {
            smoothFactor = Math.min(1.0, smoothFactor + 0.3);
        }
    }

    const diff = desiredCenterY - viewportCenterY;
    const newCenterY = viewportCenterY + diff * smoothFactor;

    // Apply camera shift
    Bounds.shift(render.bounds, {
        x: 0,
        y: newCenterY - viewportHeight / 2 - render.bounds.min.y
    });
});

function finishJump() {
    if (!isJumping) return;
    isJumping = false;

    // Add to jump history instead of tracking high scores
    const planetNames = {
        earth: '🌏 지구',
        mars: '🔴 화성',
        moon: '🌕 달'
    };

    jumpHistory.push({
        planet: planetNames[currentPlanet],
        weight: weightMultiplier.toFixed(1) + 'x',
        power: jumpPowerMultiplier.toFixed(1) + 'x',
        height: maxJumpHeight + ' cm'
    });

    updateJumpTable();

    const btn = document.getElementById('jump-btn');
    btn.disabled = false;
    btn.style.opacity = 1;
}

// Custom Render for Astronaut
Events.on(render, 'afterRender', function () {
    const ctx = render.context;
    const pos = jumper.position;
    const angle = jumper.angle;
    const s = jumperSize;

    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);

    // 1. Backpack (Gray)
    ctx.fillStyle = '#b2bec3';
    ctx.beginPath();
    ctx.roundRect(-s / 2 - 5, -s / 2 + 5, 10, s - 10, 5);
    ctx.fill();

    // 2. Body (White Suit)
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.roundRect(-s / 2, -s / 2, s, s, 10);
    ctx.fill();
    // Border
    ctx.strokeStyle = '#dfe6e9';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. Helmet Visor (Dark Blue)
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.ellipse(0, -5, s / 3, s / 4, 0, 0, 2 * Math.PI);
    ctx.fill();

    // 4. Glare on Visor
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(5, -8, 3, 2, 0, 0, 2 * Math.PI);
    ctx.fill();

    // 5. Korean Flag or Patch (Optional - Red/Blue dot)
    ctx.fillStyle = '#ff7675';
    ctx.beginPath();
    ctx.arc(0, 10, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(-angle);
    ctx.translate(-pos.x, -pos.y);
});

// --- Slider Controls ---
function initializeSliders() {
    const weightSlider = document.getElementById('weight-slider');
    const powerSlider = document.getElementById('power-slider');
    const weightValue = document.getElementById('weight-value');
    const powerValue = document.getElementById('power-value');

    if (weightSlider && powerSlider) {
        // Weight slider
        weightSlider.addEventListener('input', function () {
            weightMultiplier = parseFloat(this.value);
            weightValue.textContent = `${weightMultiplier.toFixed(1)}x`;
            updateWeight();
        });

        // Jump power slider
        powerSlider.addEventListener('input', function () {
            jumpPowerMultiplier = parseFloat(this.value);
            powerValue.textContent = `${jumpPowerMultiplier.toFixed(1)}x`;
        });
    }
}

function updateWeight() {
    // Update jumper mass based on weight multiplier
    Body.setMass(jumper, initialMass * weightMultiplier);
}

// --- Jump History Table ---
function updateJumpTable() {
    const tbody = document.getElementById('jump-table-body');

    // Clear table
    tbody.innerHTML = '';

    if (jumpHistory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #95a5a6;">점프 기록이 없습니다</td></tr>';
        return;
    }

    // Add rows in reverse order (most recent first)
    for (let i = jumpHistory.length - 1; i >= 0; i--) {
        const record = jumpHistory[i];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.planet}</td>
            <td>${record.weight}</td>
            <td>${record.power}</td>
            <td><strong>${record.height}</strong></td>
        `;
        tbody.appendChild(row);
    }
}
