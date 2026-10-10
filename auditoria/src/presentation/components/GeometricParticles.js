/**
 * Componente de UI: GeometricParticles
 * Red interactiva de constelaciones y conexiones dinámicas (Constellation Network)
 * Centrado en líneas de conexión fluidas e interactividad magnética con el cursor/touch.
 */

export class GeometricParticles {
  constructor(canvasId = "loginParticlesCanvas", containerId = "loginPageWrapper") {
    this.canvas = document.getElementById(canvasId);
    this.container = document.getElementById(containerId);
    this.ctx = this.canvas ? this.canvas.getContext("2d") : null;

    this.particles = [];
    this.animationId = null;
    this.isRunning = false;

    this.mouse = {
      x: null,
      y: null,
      radius: 170
    };

    this.width = 0;
    this.height = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.onResize = this.onResize.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.loop = this.loop.bind(this);
  }

  init() {
    if (!this.canvas || !this.ctx || !this.container) return;

    this.setupEvents();
    this.onResize();
    this.createParticles();
    this.start();
  }

  setupEvents() {
    window.addEventListener("resize", this.onResize, { passive: true });

    if (this.container) {
      this.container.addEventListener("mousemove", this.onMouseMove, { passive: true });
      this.container.addEventListener("mouseleave", this.onMouseLeave, { passive: true });
      this.container.addEventListener("touchmove", this.onTouchMove, { passive: true });
      this.container.addEventListener("touchend", this.onTouchEnd, { passive: true });
    }
  }

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
  }

  onMouseLeave() {
    this.mouse.x = null;
    this.mouse.y = null;
  }

  onTouchMove(e) {
    if (e.touches.length > 0) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.touches[0].clientX - rect.left;
      this.mouse.y = e.touches[0].clientY - rect.top;
    }
  }

  onTouchEnd() {
    this.mouse.x = null;
    this.mouse.y = null;
  }

  onResize() {
    if (!this.canvas || !this.container) return;

    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(rect.width, 320);
    this.height = Math.max(rect.height, 420);

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.scale(this.dpr, this.dpr);
    this.createParticles();
  }

  createParticles() {
    if (!this.width || !this.height) return;

    // Conteo optimizado para una red rica en conexiones sin saturación
    const count = Math.min(Math.max(Math.floor((this.width * this.height) / 10500), 36), 85);
    this.particles = [];

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.55,
        vy: (Math.random() - 0.5) * 0.55,
        radius: Math.random() * 1.5 + 1.8, // Puntos circulares discretos y limpios
        baseAlpha: Math.random() * 0.35 + 0.35
      });
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  loop() {
    if (!this.isRunning || !this.ctx) return;

    this.ctx.clearRect(0, 0, this.width, this.height);

    const maxConnDist = 130; // Distancia máxima para conectar nodos entre sí
    const mouseRadius = this.mouse.radius;
    const hasMouse = this.mouse.x !== null && this.mouse.y !== null;

    // 1. Conexiones entre partículas (Red de constelación)
    for (let i = 0; i < this.particles.length; i++) {
      const p1 = this.particles[i];
      for (let j = i + 1; j < this.particles.length; j++) {
        const p2 = this.particles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.hypot(dx, dy);

        if (dist < maxConnDist) {
          const alpha = (1 - dist / maxConnDist) * 0.22;
          this.ctx.strokeStyle = `rgba(24, 24, 27, ${alpha})`;
          this.ctx.lineWidth = 0.85;
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.stroke();
        }
      }
    }

    // 2. Conexiones dinámicas interactivas con el cursor / touch
    if (hasMouse) {
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const dx = this.mouse.x - p.x;
        const dy = this.mouse.y - p.y;
        const dist = Math.hypot(dx, dy);

        if (dist < mouseRadius) {
          // Línea interactiva más luminosa y tensa conectando al cursor
          const alpha = (1 - dist / mouseRadius) * 0.55;
          this.ctx.strokeStyle = `rgba(24, 24, 27, ${alpha})`;
          this.ctx.lineWidth = 1.1;
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(this.mouse.x, this.mouse.y);
          this.ctx.stroke();

          // Atracción magnética sutil hacia el cursor
          const force = (1 - dist / mouseRadius) * 0.035;
          p.x += dx * force;
          p.y += dy * force;
        }
      }
    }

    // 3. Actualizar y dibujar puntos limpios
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      p.x += p.vx;
      p.y += p.vy;

      // Rebote suave en los límites del contenedor
      if (p.x < 0) { p.x = 0; p.vx *= -1; }
      else if (p.x > this.width) { p.x = this.width; p.vx *= -1; }

      if (p.y < 0) { p.y = 0; p.vy *= -1; }
      else if (p.y > this.height) { p.y = this.height; p.vy *= -1; }

      // Destacar suavemente nodos cercanos al cursor
      let nodeAlpha = p.baseAlpha;
      let nodeRadius = p.radius;

      if (hasMouse) {
        const distToMouse = Math.hypot(this.mouse.x - p.x, this.mouse.y - p.y);
        if (distToMouse < mouseRadius) {
          const proximity = 1 - distToMouse / mouseRadius;
          nodeAlpha = Math.min(1, p.baseAlpha + proximity * 0.45);
          nodeRadius = p.radius * (1 + proximity * 0.4);
        }
      }

      // Dibujar punto circular nítido
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, nodeRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(24, 24, 27, ${nodeAlpha})`;
      this.ctx.fill();
    }

    this.animationId = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.stop();
    window.removeEventListener("resize", this.onResize);
    if (this.container) {
      this.container.removeEventListener("mousemove", this.onMouseMove);
      this.container.removeEventListener("mouseleave", this.onMouseLeave);
      this.container.removeEventListener("touchmove", this.onTouchMove);
      this.container.removeEventListener("touchend", this.onTouchEnd);
    }
    this.particles = [];
  }
}
