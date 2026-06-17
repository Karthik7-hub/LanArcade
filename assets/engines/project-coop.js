/**
 * Project Coop: AAA Server Engine
 * Supports Stacking, Weighted Pushing, Dynamic Scaling, and Multi-body Physics
 */

const engine = {
    config: {
        tickRate: 60,
        gravity: 0.6,
        friction: 0.15,
        jumpForce: -13,
        moveSpeed: 5,
        playerSize: { w: 32, h: 32 },
        terminalVelocity: 15
    },

    state: {
        status: 'lobby',
        tick: 0,
        players: {},
        entities: [],
        levelId: 1,
        camera: { x: 0, y: 0, zoom: 1 },
        teamDeaths: 0,
        startTime: 0,
        playersAtExit: []
    },

    onInit: function(settings, players) {
        this.state.players = {};
        players.forEach((p, i) => {
            this.state.players[p.id] = {
                id: p.id,
                name: p.name,
                x: 100 + (i * 40),
                y: 400,
                vx: 0,
                vy: 0,
                grounded: false,
                facing: 1,
                color: this.getPlayerColor(i),
                state: 'idle',
                isDead: false
            };
        });

        this.state.startTime = Date.now();
        this.loadLevel(this.state.levelId);
        this.state.status = 'play';
        this.sync();
    },

    getPlayerColor: function(i) {
        const colors = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#F97316'];
        return colors[i % colors.length];
    },

    loadLevel: function(id) {
        const pCount = Object.keys(this.state.players).length;
        this.state.playersAtExit = [];

        if (id === 1) {
            this.state.entities = [
                { id: 'f1', type: 'platform', x: 0, y: 550, w: 600, h: 50 },
                { id: 'f2', type: 'platform', x: 750 + (pCount * 20), y: 550, w: 1000, h: 50 },
                { id: 'box1', type: 'block', x: 400, y: 500, w: 64, h: 50, mass: Math.ceil(pCount * 0.5) },
                { id: 'key1', type: 'key', x: 500, y: 400, active: true },
                { id: 'door1', type: 'door', x: 1200, y: 450, w: 64, h: 100, locked: true }
            ];
        } else if (id === 2) {
            // Level 2: Stacking Challenge
            this.state.entities = [
                { id: 'f1', type: 'platform', x: 0, y: 550, w: 400, h: 50 },
                { id: 'wall1', type: 'platform', x: 400, y: 200, w: 50, h: 400 },
                { id: 'high_plat', type: 'platform', x: 450, y: 300, w: 800, h: 50 },
                { id: 'key1', type: 'key', x: 350, y: 100, active: true }, // Needs stacking to reach
                { id: 'door1', type: 'door', x: 1000, y: 200, w: 64, h: 100, locked: true }
            ];
        }
    },

    onAction: function(player, action) {
        const p = this.state.players[player.id];
        if (!p || p.isDead) return;

        if (action.type === 'INPUT') {
            const input = action.data;
            if (input.left) { p.vx = -this.config.moveSpeed; p.facing = -1; p.state = 'walk'; }
            else if (input.right) { p.vx = this.config.moveSpeed; p.facing = 1; p.state = 'walk'; }
            else { p.vx *= (1 - this.config.friction); if (Math.abs(p.vx) < 0.1) { p.vx = 0; p.state = 'idle'; } }

            if (input.jump && p.grounded) { p.vy = this.config.jumpForce; p.grounded = false; p.state = 'jump'; }
        }
    },

    onTick: function(dt) {
        if (this.state.status !== 'play') return;
        this.state.tick++;
        this.updateEntities();

        let playersFinished = 0;
        for (let id in this.state.players) {
            const p = this.state.players[id];
            if (p.isDead) continue;
            p.vy = Math.min(p.vy + this.config.gravity, this.config.terminalVelocity);
            p.y += p.vy;
            this.resolveCollisions(p, 'y');
            p.x += p.vx;
            this.resolveCollisions(p, 'x');

            if (p.y > 800) this.killPlayer(p);

            // Exit Logic
            const door = this.state.entities.find(e => e.type === 'door');
            if (door && !door.locked && this.checkOverlap({left: p.x, right: p.x+32, top: p.y, bottom: p.y+32}, door)) {
                playersFinished++;
            }
        }

        if (playersFinished === Object.keys(this.state.players).length && playersFinished > 0) {
            this.completeLevel();
        }

        this.updateCamera();
        if (this.state.tick % 2 === 0) this.sync();
    },

    completeLevel: function() {
        if (this.state.levelId < 2) {
            this.state.levelId++;
            this.loadLevel(this.state.levelId);
            for(let id in this.state.players) {
                this.state.players[id].x = 100;
                this.state.players[id].y = 400;
            }
        } else {
            this.state.status = 'win';
        }
    },

    updateEntities: function() {
        this.state.entities.forEach(e => {
            if (e.type === 'block') {
                let pushers = [];
                for(let id in this.state.players) {
                    const p = this.state.players[id];
                    if (this.isPushing(p, e)) pushers.push(p);
                }
                if (pushers.length >= e.mass) {
                    const dir = pushers[0].vx > 0 ? 1 : -1;
                    e.x += dir * (this.config.moveSpeed * 0.5);
                }
            }
        });
    },

    isPushing: function(p, b) {
        return Math.abs(p.y - (b.y + b.h/2)) < 20 &&
               ((p.x + this.config.playerSize.w >= b.x && p.x < b.x && p.vx > 0) ||
                (p.x <= b.x + b.w && p.x > b.x && p.vx < 0));
    },

    resolveCollisions: function(obj, axis) {
        const bounds = { left: obj.x, right: obj.x + 32, top: obj.y, bottom: obj.y + 32 };
        this.state.entities.forEach(e => {
            if (e.type === 'platform' || e.type === 'block' || (e.type === 'door' && e.locked)) {
                if (this.checkOverlap(bounds, e)) {
                    if (axis === 'y') {
                        if (obj.vy > 0) { obj.y = e.y - 32; obj.grounded = true; }
                        else { obj.y = e.y + e.h; }
                        obj.vy = 0;
                    } else {
                        if (obj.vx > 0) obj.x = e.x - 32; else obj.x = e.x + e.w;
                        obj.vx = 0;
                    }
                }
            }
            if (e.type === 'key' && e.active && this.checkOverlap(bounds, { ...e, w: 32, h: 32 })) {
                e.active = false;
                const door = this.state.entities.find(ent => ent.type === 'door');
                if (door) door.locked = false;
            }
        });

        for (let otherId in this.state.players) {
            if (otherId === obj.id) continue;
            const other = this.state.players[otherId];
            if (other.isDead) continue;
            const otherBounds = { x: other.x, y: other.y, w: 32, h: 32 };
            if (this.checkOverlap(bounds, otherBounds)) {
                if (axis === 'y' && obj.vy > 0 && obj.y < other.y) {
                    obj.y = other.y - 32;
                    obj.grounded = true;
                    obj.vy = 0;
                }
            }
        }
    },

    checkOverlap: function(a, b) {
        return a.left < b.x + b.w && a.right > b.x && a.top < b.y + b.h && a.bottom > b.y;
    },

    updateCamera: function() {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (let id in this.state.players) {
            const p = this.state.players[id];
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
        const centerX = (minX + maxX) / 2 + 16;
        const centerY = (minY + maxY) / 2 + 16;
        const width = Math.max(600, (maxX - minX) + 400);
        this.state.camera = { x: centerX, y: centerY, zoom: 1000 / width };
    },

    killPlayer: function(p) {
        p.isDead = true;
        this.state.teamDeaths++;
        p.x = 100; p.y = 100; p.vx = 0; p.vy = 0;
        setTimeout(() => { p.isDead = false; }, 1000);
    },

    sync: function() {
        Arcade.broadcastPublicState({
            tick: this.state.tick,
            players: this.state.players,
            entities: this.state.entities,
            camera: this.state.camera,
            status: this.state.status,
            levelId: this.state.levelId,
            deaths: this.state.teamDeaths
        });
    }
};
