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
const wallLeft = Bodies.rectangle(-10, height/2, 20, height * 10, { isStatic: true }); // Taller walls
const wallRight = Bodies.rectangle(width + 10, height/2, 20, height * 10, { isStatic: true });
const ceiling = Bodies.rectangle(width/2, -5000, width, 50, { isStatic: true }); // Very high ceiling

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
const jumpForce = 0.042 * jumper.mass; 
let isJumping = false;
let maxJumpHeight = 0;
const scores = { earth: 0, mars: 0, moon: 0 };

// Initial Setup
setPlanet('earth');

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

    Body.applyForce(jumper, jumper.position, { x: 0, y: -jumpForce });
    
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

// Update Loop
Events.on(engine, 'afterUpdate', function() {
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
        if (Math.abs(jumper.velocity.y) < 0.1 && Math.abs(currentH) < 2 && jumper.position.y > height/2) {
            finishJump();
        }
    }

    // --- Camera Follow Logic ---
    // Center the camera on the jumper if they go too high
    const viewportCenterY = render.bounds.min.y + (render.bounds.max.y - render.bounds.min.y) / 2;
    const targetY = jumper.position.y;
    
    // Desired center Y for camera
    let desiredCenterY = targetY;
    
    // Clamp desiredCenterY so we don't show below ground
    // Ground is at 'height'. Viewport height is 'height'.
    // Max center Y should be height / 2 (which corresponds to bounds.max.y = height)
    if (desiredCenterY > height / 2) {
        desiredCenterY = height / 2;
    }

    // Smoothly interpolate current center to desired center
    const diff = desiredCenterY - viewportCenterY;
    const newCenterY = viewportCenterY + diff * 0.1; // Smooth factor

    // Calculate new bounds
    const halfHeight = (render.bounds.max.y - render.bounds.min.y) / 2;
    
    Bounds.shift(render.bounds, {
        x: 0,
        y: newCenterY - halfHeight - render.bounds.min.y
    });
});

function finishJump() {
    if (!isJumping) return;
    isJumping = false;
    
    if (maxJumpHeight > scores[currentPlanet]) {
        scores[currentPlanet] = maxJumpHeight;
        document.getElementById(`score-${currentPlanet}`).innerText = `${maxJumpHeight} cm`;
        const scoreEl = document.getElementById(`score-${currentPlanet}`);
        scoreEl.style.color = '#d63031';
        setTimeout(() => scoreEl.style.color = '#636e72', 1000);
    }

    const btn = document.getElementById('jump-btn');
    btn.disabled = false;
    btn.style.opacity = 1;
    
    // Reset Camera smoothly or instantly? 
    // The update loop handles smooth return to ground because jumper returns to ground.
}

// Custom Render for Astronaut
Events.on(render, 'afterRender', function() {
    const ctx = render.context;
    const pos = jumper.position;
    const angle = jumper.angle;
    const s = jumperSize;

    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);

    // 1. Backpack (Gray)
    ctx.fillStyle = '#b2bec3';
    ctx.beginPath();
    ctx.roundRect(-s/2 - 5, -s/2 + 5, 10, s - 10, 5);
    ctx.fill();

    // 2. Body (White Suit)
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.roundRect(-s/2, -s/2, s, s, 10);
    ctx.fill();
    // Border
    ctx.strokeStyle = '#dfe6e9';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. Helmet Visor (Dark Blue)
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.ellipse(0, -5, s/3, s/4, 0, 0, 2 * Math.PI);
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
