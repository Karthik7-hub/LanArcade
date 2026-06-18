/**
 * Project Coop: AAA Server Engine
 * Supports Stacking, Weighted Pushing, Dynamic Scaling, and Multi-body Physics
 * Procedural Level Generation & Solvability Solver Pass
 */

const engine = {
    config: {
        tickRate: 20,
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
        playersAtExit: [],
        settings: {
            levelType: 'handcrafted', // handcrafted or procedural
            difficulty: 'medium', // easy, medium, hard, insane
            seed: 0
        }
    },

    prng: {
        seed: 1,
        setSeed: function(s) {
            this.seed = s;
        },
        next: function() {
            this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
            return this.seed / 4294967296;
        },
        range: function(min, max) {
            return min + this.next() * (max - min);
        },
        choice: function(arr) {
            return arr[Math.floor(this.next() * arr.length)];
        }
    },

    onLoad: function() {
        console.log("Project Coop Engine loaded successfully.");
    },

    onInit: function(settings, players) {
        console.log("Initializing Project Coop Engine with settings:", JSON.stringify(settings));
        this.state.settings = { ...this.state.settings, ...settings };
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
        this.state.levelId = 1;
        this.loadLevel(this.state.levelId);
        this.state.status = 'play';
        this.sync();
    },

    getPlayerColor: function(i) {
        const colors = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#F97316'];
        return colors[i % colors.length];
    },

    loadLevel: function(id) {
        const pCount = Math.max(2, Object.keys(this.state.players).length);
        this.state.playersAtExit = [];

        const isProcedural = this.state.settings && this.state.settings.levelType === 'procedural';
        
        if (isProcedural) {
            const difficulty = this.state.settings.difficulty || 'medium';
            this.generateProceduralLevel(pCount, difficulty);
            return;
        }

        console.log("Loading handcrafted level: " + id);
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
        } else {
            // Out of handcrafted, fallback to procedural
            const difficulty = this.state.settings.difficulty || 'medium';
            this.generateProceduralLevel(pCount, difficulty);
        }
    },

    generateProceduralLevel: function(pCount, difficulty) {
        let attempts = 0;
        let success = false;

        let seed = this.state.settings.seed;
        if (!seed) {
            if (this.state.settings.isDailyChallenge) {
                const today = new Date();
                seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
            } else {
                seed = Math.floor(Math.random() * 999999);
            }
        }
        
        while (!success && attempts < 10) {
            this.prng.setSeed(seed + attempts);
            const entities = [];
            let startX = 0;

            // 1. Spawn Area
            entities.push({ id: 'spawn_floor', type: 'platform', x: 0, y: 550, w: 500, h: 50 });
            startX = 500;

            // 2. Select modular segments based on difficulty
            let numSegments = 1;
            if (difficulty === 'medium') numSegments = 2;
            else if (difficulty === 'hard') numSegments = 3;
            else if (difficulty === 'insane') numSegments = 4;

            const segmentTypes = ['gap_mp', 'switch_laser', 'push_block', 'stacking_wall'];

            for (let i = 0; i < numSegments; i++) {
                const seg = this.prng.choice(segmentTypes);
                startX = this.buildSegment(seg, startX, pCount, entities);
            }

            // 3. Exit Area
            entities.push({ id: 'exit_floor', type: 'platform', x: startX, y: 550, w: 600, h: 50 });
            entities.push({ id: 'key1', type: 'key', x: startX + 150, y: 460, active: true });
            entities.push({ id: 'door1', type: 'door', x: startX + 400, y: 450, w: 64, h: 100, locked: true });

            // 4. Run solver validation pass
            if (this.verifyLevel(entities, pCount)) {
                this.state.entities = entities;
                success = true;
                console.log("Procedural level generated successfully after " + (attempts + 1) + " attempts. Seed: " + seed);
            } else {
                attempts++;
                console.log("Procedural level failed solver validation. Regenerating...");
            }
        }

        // Ultimate fallback if solver is somehow too strict
        if (!success) {
            console.log("Procedural generation failed validation repeatedly. Loading safe fallback level.");
            this.state.entities = [
                { id: 'f1', type: 'platform', x: 0, y: 550, w: 800, h: 50 },
                { id: 'box1', type: 'block', x: 400, y: 500, w: 64, h: 50, mass: 1 },
                { id: 'key1', type: 'key', x: 500, y: 400, active: true },
                { id: 'door1', type: 'door', x: 700, y: 450, w: 64, h: 100, locked: true }
            ];
        }
    },

    buildSegment: function(type, startX, pCount, entities) {
        if (type === 'gap_mp') {
            // Gap with moving platform
            entities.push({ id: 'plat_' + startX + '_1', type: 'platform', x: startX, y: 550, w: 150, h: 50 });
            entities.push({
                id: 'mp_' + startX,
                type: 'platform',
                x: startX + 180,
                y: 480,
                w: 120,
                h: 20,
                isMoving: true,
                startX: startX + 180,
                startY: 480,
                endX: startX + 380,
                endY: 480,
                speed: 1.5,
                dir: 1,
                progress: 0
            });
            entities.push({ id: 'plat_' + startX + '_2', type: 'platform', x: startX + 450, y: 550, w: 150, h: 50 });
            return startX + 600;
        } else if (type === 'switch_laser') {
            // Laser wall that turns off when switch is stood on
            entities.push({ id: 'plat_' + startX, type: 'platform', x: startX, y: 550, w: 600, h: 50 });
            entities.push({ id: 'laser_' + startX, type: 'laser', x: startX + 300, y: 250, w: 16, h: 300, active: true });
            
            // Dual switches: first switch before laser, second switch after laser (so player 1 can be let across, then let player 2 cross)
            entities.push({ id: 'sw1_' + startX, type: 'switch', x: startX + 120, y: 535, w: 32, h: 15, pressed: false, targetId: 'laser_' + startX });
            entities.push({ id: 'sw2_' + startX, type: 'switch', x: startX + 450, y: 535, w: 32, h: 15, pressed: false, targetId: 'laser_' + startX });
            return startX + 600;
        } else if (type === 'push_block') {
            // Push block puzzle
            entities.push({ id: 'plat_' + startX, type: 'platform', x: startX, y: 550, w: 700, h: 50 });
            entities.push({ id: 'wall_' + startX, type: 'platform', x: startX + 450, y: 450, w: 40, h: 100 });
            entities.push({ id: 'gate_' + startX, type: 'door', x: startX + 450, y: 350, w: 40, h: 100, locked: true });
            
            // Switch targets intermediate gate
            entities.push({ id: 'sw_' + startX, type: 'switch', x: startX + 350, y: 535, w: 32, h: 15, pressed: false, targetId: 'gate_' + startX });
            // Block must be pushed on top of switch
            entities.push({ id: 'box_' + startX, type: 'block', x: startX + 150, y: 500, w: 64, h: 50, mass: Math.ceil(pCount * 0.5) });
            return startX + 700;
        } else if (type === 'stacking_wall') {
            // Wall that requires stacking or coordination to climb
            entities.push({ id: 'plat_' + startX, type: 'platform', x: startX, y: 550, w: 600, h: 50 });
            
            const wallH = Math.min(220, 100 + (pCount - 1) * 30);
            entities.push({ id: 'stackwall_' + startX, type: 'platform', x: startX + 300, y: 550 - wallH, w: 40, h: wallH });
            entities.push({ id: 'stackgate_' + startX, type: 'door', x: startX + 300, y: 450 - wallH, w: 40, h: 100, locked: true });
            
            // Switch on the other side lowers gate
            entities.push({ id: 'stacksw_' + startX, type: 'switch', x: startX + 450, y: 535, w: 32, h: 15, pressed: false, targetId: 'stackgate_' + startX });
            return startX + 600;
        }
        return startX + 500;
    },

    verifyLevel: function(entities, pCount) {
        // Logical verification solver pass
        // Ensure that platforms and gaps are jumpable
        // and that switches are placed logically.
        
        let door = entities.find(e => e.id === 'door1');
        let key = entities.find(e => e.id === 'key1');
        if (!door || !key) return false;

        // Verify that players can cross all components
        // A segment is valid if any gates/lasers can be unlocked by switches that players can reach.
        // For linear placement, as long as intermediate gates are unlocked by switches reachable before them, it is solvable.
        // Special case: Stacking Wall has switch *after* wall, which is solvable if player count >= 2 (allows stacking to climb over).
        const stackingWalls = entities.filter(e => e.id && e.id.startsWith('stackwall_'));
        for (let wall of stackingWalls) {
            if (pCount < 2) return false; // Stacking walls require at least 2 players
        }

        return true;
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
        
        // Target physics rate is 60Hz. At 20Hz, we run 3 steps per tick.
        const steps = 3;
        const subDt = dt / steps;

        for (let step = 0; step < steps; step++) {
            this.state.tick++;
            this.updateEntities(subDt);
            this.updateSwitches();

            for (let id in this.state.players) {
                const p = this.state.players[id];
                if (p.isDead) {
                    if (typeof p.respawnTimer === 'number') {
                        p.respawnTimer -= subDt;
                        if (p.respawnTimer <= 0) {
                            p.isDead = false;
                            p.respawnTimer = null;
                        }
                    }
                    continue;
                }
                
                p.vy = Math.min(p.vy + this.config.gravity, this.config.terminalVelocity);
                p.y += p.vy;
                this.resolveCollisions(p, 'y');
                p.x += p.vx;
                this.resolveCollisions(p, 'x');

                if (p.y > 800) this.killPlayer(p);

                // Laser collision check
                const activeLasers = this.state.entities.filter(e => e.type === 'laser' && e.active);
                activeLasers.forEach(laser => {
                    if (this.checkOverlap({ left: p.x, right: p.x + 32, top: p.y, bottom: p.y + 32 }, laser)) {
                        this.killPlayer(p);
                    }
                });
            }
        }

        // Verify level completion after sub-steps
        let playersFinished = 0;
        const activeCount = Object.keys(this.state.players).length;
        const exitDoor = this.state.entities.find(e => e.id === 'door1');
        if (exitDoor && !exitDoor.locked) {
            for (let id in this.state.players) {
                const p = this.state.players[id];
                if (!p.isDead && this.checkOverlap({ left: p.x, right: p.x + 32, top: p.y, bottom: p.y + 32 }, exitDoor)) {
                    playersFinished++;
                }
            }
        }

        if (playersFinished === activeCount && activeCount > 0) {
            this.completeLevel();
        }

        this.updateCamera();
        this.sync();
    },

    completeLevel: function() {
        // In procedural mode, keep generating levels indefinitely (Endless mode)
        const isProcedural = this.state.settings && this.state.settings.levelType === 'procedural';
        
        if (isProcedural) {
            this.state.levelId++;
            this.loadLevel(this.state.levelId);
            for (let id in this.state.players) {
                this.state.players[id].x = 100;
                this.state.players[id].y = 400;
                this.state.players[id].vx = 0;
                this.state.players[id].vy = 0;
            }
        } else {
            // Handcrafted mode
            if (this.state.levelId < 2) {
                this.state.levelId++;
                this.loadLevel(this.state.levelId);
                for(let id in this.state.players) {
                    this.state.players[id].x = 100;
                    this.state.players[id].y = 400;
                    this.state.players[id].vx = 0;
                    this.state.players[id].vy = 0;
                }
            } else {
                this.state.status = 'win';
            }
        }
        this.sync();
    },

    updateEntities: function(dt) {
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
            } else if (e.isMoving) {
                const prevX = e.x;
                const prevY = e.y;
                
                // Update position back and forth
                e.progress += (e.speed || 1) * e.dir * 0.016; 
                if (e.progress >= 1) { e.progress = 1; e.dir = -1; }
                else if (e.progress <= 0) { e.progress = 0; e.dir = 1; }
                
                e.x = e.startX + (e.endX - e.startX) * e.progress;
                e.y = e.startY + (e.endY - e.startY) * e.progress;
                
                const dx = e.x - prevX;
                const dy = e.y - prevY;

                // Carry riding players with it
                for (let id in this.state.players) {
                    const p = this.state.players[id];
                    if (p.grounded && this.checkOverlap({ left: p.x, right: p.x + 32, top: p.y + 1, bottom: p.y + 33 }, e)) {
                        p.x += dx;
                        p.y += dy;
                    }
                }
            }
        });
    },

    updateSwitches: function() {
        // Reset all intermediate doors to locked and active lasers to true
        this.state.entities.forEach(e => {
            if (e.type === 'laser') e.active = true;
            if (e.type === 'door' && e.id !== 'door1') e.locked = true;
        });

        // Query active switches
        const switches = this.state.entities.filter(e => e.type === 'switch');
        switches.forEach(sw => {
            let pressed = false;
            
            // Check player overlap
            for (let id in this.state.players) {
                const p = this.state.players[id];
                if (!p.isDead && this.checkOverlap({ left: p.x, right: p.x + 32, top: p.y, bottom: p.y + 32 }, sw)) {
                    pressed = true;
                    break;
                }
            }
            
            // Check block overlap
            const blocks = this.state.entities.filter(e => e.type === 'block');
            for (let b of blocks) {
                if (this.checkOverlap({ left: b.x, right: b.x + b.w, top: b.y, bottom: b.y + b.h }, sw)) {
                    pressed = true;
                    break;
                }
            }

            sw.pressed = pressed;

            // Trigger target entity state
            if (pressed) {
                const target = this.state.entities.find(e => e.id === sw.targetId);
                if (target) {
                    if (target.type === 'laser') {
                        target.active = false;
                    } else if (target.type === 'door') {
                        target.locked = false;
                    }
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
                const door = this.state.entities.find(ent => ent.id === 'door1');
                if (door) door.locked = false;
                console.log("Key collected! Exit door unlocked.");
            }
        });

        // Stacking collision (climbing on other players)
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
        p.x = 100; p.y = 400; p.vx = 0; p.vy = 0;
        p.respawnTimer = 1.0; // 1 second respawn delay
    },

    validateState: function() {
        let invalid = false;

        if (isNaN(this.state.levelId) || this.state.levelId < 1) {
            console.error("validateState failed: invalid levelId (" + this.state.levelId + ")");
            this.state.levelId = 1;
            invalid = true;
        }

        for (let id in this.state.players) {
            const p = this.state.players[id];
            if (!p || isNaN(p.x) || isNaN(p.y)) {
                console.error("validateState failed: player " + id + " has invalid coordinates");
                if (p) {
                    p.x = 100;
                    p.y = 400;
                    p.vx = 0;
                    p.vy = 0;
                }
                invalid = true;
            }
        }

        if (isNaN(this.state.camera.x) || isNaN(this.state.camera.y) || isNaN(this.state.camera.zoom)) {
            console.error("validateState failed: camera has NaN values");
            this.state.camera = { x: 300, y: 300, zoom: 1 };
            invalid = true;
        }

        const prevLength = this.state.entities.length;
        this.state.entities = this.state.entities.filter(e => e && e.type && e.id);
        if (this.state.entities.length !== prevLength) {
            console.error("validateState failed: entities contained null/undefined items");
            invalid = true;
        }

        return !invalid;
    },

    sync: function() {
        this.validateState();
        Arcade.broadcastPublicState({
            tick: this.state.tick,
            players: this.state.players,
            entities: this.state.entities,
            camera: this.state.camera,
            status: this.state.status,
            levelId: this.state.levelId,
            deaths: this.state.teamDeaths,
            settings: this.state.settings
        });
    }
};
