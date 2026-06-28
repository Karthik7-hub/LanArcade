/**
 * Carrom Authoritative JS Engine
 * Handles 30Hz vector physics, sub-stepping, 2D collisions, boundary constraints,
 * pocketing, queen covering rules, turn-based lobbies, and game settings.
 */

const engine = {
    config: {
        tickRate: 30 // 30 Hz ticks for smooth coordinate broadcasts
    },

    state: {
        status: 'waiting', // waiting, active, finished
        players: [], // array of player IDs
        playerColors: {}, // map of player ID -> color
        scores: {}, // map of playerId -> score
        turnOrder: [], // color order: red, green, yellow, blue
        currentTurnIndex: 0,
        striker: { x: 400, y: 650, vx: 0, vy: 0, active: true },
        coins: [], // array of { id, type (white, black, queen), x, y, vx, vy, active }
        simulating: false,
        shotCooldown: false,
        winner: null,
        queenStatus: 'board', // board, pocketed_pending_cover, covered, pocketed_not_covered
        queenPocketedBy: null, // player ID who pocketed the queen
        pocketedThisTurn: [], // coins pocketed during current shot
        timerRemaining: 0,
        settings: {
            preset: 'classic',
            boardFriction: 0.02,
            queenRequired: true
        }
    },

    // Physical dimensions in coordinate space (800x800 board)
    BOARD_SIZE: 800,
    COIN_RADIUS: 15,
    STRIKER_RADIUS: 21,
    POCKET_RADIUS: 36,
    COIN_MASS: 1.0,
    STRIKER_MASS: 3.0,

    // Pocket positions
    POCKETS: [
        { x: 52, y: 52 },
        { x: 748, y: 52 },
        { x: 52, y: 748 },
        { x: 748, y: 748 }
    ],

    // Local-to-Global rotation angle index maps
    ANGLES: [0, Math.PI, Math.PI / 2, -Math.PI / 2],

    onLoad: function() {
        console.log("Carrom Engine loaded.");
    },

    onInit: function(settings, players) {
        console.log("Initializing Carrom with players:", JSON.stringify(players));
        this.state.settings = { ...this.state.settings, ...settings };
        this.state.players = players.map(p => p.id);
        this.state.turnOrder = [];
        this.state.scores = {};
        this.state.winner = null;
        this.state.simulating = false;
        this.state.shotCooldown = false;
        this.state.queenStatus = 'board';
        this.state.queenPocketedBy = null;

        const colors = ['red', 'green', 'yellow', 'blue'];
        this.state.stats = {};
        players.forEach((p, idx) => {
            const color = colors[idx];
            this.state.playerColors[p.id] = color;
            this.state.turnOrder.push(color);
            this.state.scores[p.id] = 0;
            this.state.stats[p.id] = { pocketed: 0, fouls: 0 };
        });

        this.state.currentTurnIndex = 0;
        this.state.status = 'active';

        this.setupCoins();
        this.resetStriker();
        this.resetTurnTimer();
        this.sync();
    },

    setupCoins: function() {
        this.state.coins = [];
        let coinId = 0;
        const r = 15;
        const spacing = r * 2 + 1.0; // 31.0px center-to-center

        // 1. Queen at exact center
        this.state.coins.push({
            id: coinId++,
            type: 'queen',
            x: 400,
            y: 400,
            vx: 0,
            vy: 0,
            active: true
        });

        // 2. Inner Ring of 6 coins (alternating white and black)
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const type = (i % 2 === 0) ? 'white' : 'black';
            this.state.coins.push({
                id: coinId++,
                type: type,
                x: 400 + Math.cos(angle) * spacing,
                y: 400 + Math.sin(angle) * spacing,
                vx: 0,
                vy: 0,
                active: true
            });
        }

        // 3. Outer Ring of 12 coins
        const r2 = spacing * Math.sqrt(3);
        const r2Corner = spacing * 2.0;

        for (let i = 0; i < 12; i++) {
            let angle, dist;
            if (i % 2 === 0) {
                angle = (i * Math.PI) / 6;
                dist = r2Corner;
            } else {
                angle = (i * Math.PI) / 6;
                dist = r2;
            }
            const type = (i % 2 === 0) ? 'black' : 'white';
            this.state.coins.push({
                id: coinId++,
                type: type,
                x: 400 + Math.cos(angle) * dist,
                y: 400 + Math.sin(angle) * dist,
                vx: 0,
                vy: 0,
                active: true
            });
        }
    },

    resetStriker: function() {
        const turnIdx = this.state.currentTurnIndex;
        const angle = this.ANGLES[turnIdx];
        const localX = 0;
        const localY = 240;

        this.state.striker.x = 400 + localX * Math.cos(angle) - localY * Math.sin(angle);
        this.state.striker.y = 400 + localX * Math.sin(angle) + localY * Math.cos(angle);
        this.state.striker.vx = 0;
        this.state.striker.vy = 0;
        this.state.striker.active = true;
    },

    resetTurnTimer: function() {
        this.state.timerRemaining = this.state.settings.turnTimer || 30;
    },

    getCurrentPlayerId: function() {
        const turnColor = this.state.turnOrder[this.state.currentTurnIndex];
        return this.state.players.find(id => this.state.playerColors[id] === turnColor);
    },

    onAction: function(player, action) {
        if (action.type === 'update_settings') {
            if (action.data && action.data.settings) {
                this.state.settings = { ...this.state.settings, ...action.data.settings };
                this.sync();
            }
            return;
        }

        if (this.state.status !== 'active') return;

        const activePlayerId = this.getCurrentPlayerId();
        if (player.id !== activePlayerId) {
            console.log("Not player's turn.");
            return;
        }

        if (this.state.simulating || this.state.shotCooldown) {
            console.log("Simulation in progress, action ignored.");
            return;
        }

        switch (action.type) {
            case 'position_striker':
                this.handlePositionStriker(action.data.x);
                break;
            case 'shoot':
                this.handleShoot(activePlayerId, action.data.vx, action.data.vy);
                break;
        }
    },

    handlePositionStriker: function(localX) {
        const constrainedX = Math.max(-200, Math.min(200, localX));
        const turnIdx = this.state.currentTurnIndex;
        const angle = this.ANGLES[turnIdx];
        const localY = 240;

        this.state.striker.x = 400 + constrainedX * Math.cos(angle) - localY * Math.sin(angle);
        this.state.striker.y = 400 + constrainedX * Math.sin(angle) + localY * Math.cos(angle);
        this.sync();
    },

    handleShoot: function(playerId, vxG, vyG) {
        // Apply impulse to striker
        this.state.striker.vx = vxG;
        this.state.striker.vy = vyG;
        
        this.state.simulating = true;
        this.state.shotCooldown = true;
        this.state.pocketedThisTurn = [];
        this.state.restCheckAccumulator = 0; // accumulator for stable rest detection
        
        this.sync();
    },

    onPlayerLeave: function(player) {
        console.log("Player left: " + player.id);
        if (!this.state.offlinePlayers) this.state.offlinePlayers = [];
        if (!this.state.offlinePlayers.includes(player.id)) {
            this.state.offlinePlayers.push(player.id);
        }
        this.sync();
    },

    onPlayerJoin: function(player) {
        console.log("Player rejoined: " + player.id);
        if (this.state.offlinePlayers) {
            this.state.offlinePlayers = this.state.offlinePlayers.filter(id => id !== player.id);
        }
        this.sync();
    },

    onTick: function(dt) {
        if (this.state.status !== 'active') return;

        if (this.state.simulating) {
            this.runPhysicsStep(dt);
        } else {
            // Decement turn timer
            if (this.state.timerRemaining > 0) {
                this.state.timerRemaining -= dt;
                if (this.state.timerRemaining <= 0) {
                    this.state.timerRemaining = 0;
                    this.handleTimeout();
                }
            }
        }
    },

    runPhysicsStep: function(dt) {
        // Sub-stepping for higher accuracy collisions (8 sub-steps per frame)
        const subSteps = 8;
        const subDt = dt / subSteps;

        for (let step = 0; step < subSteps; step++) {
            this.updateVelocitiesAndPositions(subDt);
            this.resolveCollisions();
            this.checkWallCollisions();
            this.checkPocketing();
        }

        // Check if everything has come to a rest
        let allRest = true;
        const restEpsilon = 0.5;

        if (this.state.striker.active) {
            const speed = Math.hypot(this.state.striker.vx, this.state.striker.vy);
            if (speed > restEpsilon) allRest = false;
        }

        this.state.coins.forEach(c => {
            if (c.active) {
                const speed = Math.hypot(c.vx, c.vy);
                if (speed > restEpsilon) allRest = false;
            }
        });

        if (allRest) {
            // Stable rest detection: velocities must remain below threshold for 0.3s
            this.state.restCheckAccumulator += dt;
            if (this.state.restCheckAccumulator >= 0.3) {
                this.state.simulating = false;
                this.state.restCheckAccumulator = 0;
                
                // Stop velocities completely
                this.state.striker.vx = 0;
                this.state.striker.vy = 0;
                this.state.coins.forEach(c => { c.vx = 0; c.vy = 0; });
                
                this.resolveTurnOutcome();
            }
        } else {
            this.state.restCheckAccumulator = 0;
        }

        this.sync();
    },

    updateVelocitiesAndPositions: function(dt) {
        const baseFriction = this.state.settings.boardFriction * 50;

        const applyDecel = (item) => {
            if (!item.active) return;
            const speed = Math.hypot(item.vx, item.vy);
            if (speed > 0) {
                const drag = 0.25 * baseFriction;
                const constFriction = 28 * baseFriction;
                let decel = constFriction + drag * speed;
                const newSpeed = Math.max(0, speed - decel * dt);
                item.vx = (item.vx / speed) * newSpeed;
                item.vy = (item.vy / speed) * newSpeed;
            }
            item.x += item.vx * dt;
            item.y += item.vy * dt;
        };

        applyDecel(this.state.striker);
        this.state.coins.forEach(applyDecel);
    },

    resolveCollisions: function() {
        const items = [];
        if (this.state.striker.active) {
            items.push({ item: this.state.striker, radius: this.STRIKER_RADIUS, mass: this.STRIKER_MASS, isStriker: true });
        }
        this.state.coins.forEach(c => {
            if (c.active) {
                items.push({ item: c, radius: this.COIN_RADIUS, mass: this.COIN_MASS, isStriker: false });
            }
        });

        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                const a = items[i];
                const b = items[j];

                const dx = b.item.x - a.item.x;
                const dy = b.item.y - a.item.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = a.radius + b.radius;

                if (dist < minDist) {
                    // Collision Normal vector
                    const nx = dx / dist;
                    const ny = dy / dist;

                    // Soft overlap correction to prevent jitter/wobble oscillations
                    const overlap = minDist - dist;
                    if (overlap > 0) {
                        const totalMass = a.mass + b.mass;
                        const percent = 0.22; // resolve 22% of overlap per sub-step
                        const slop = 0.02; // allowance
                        const correctionAmount = Math.max(0, overlap - slop) * percent;
                        const correctionX = nx * correctionAmount;
                        const correctionY = ny * correctionAmount;

                        a.item.x -= correctionX * (b.mass / totalMass);
                        a.item.y -= correctionY * (b.mass / totalMass);
                        b.item.x += correctionX * (a.mass / totalMass);
                        b.item.y += correctionY * (a.mass / totalMass);
                    }

                    // Elastic collision response velocities
                    const kx = a.item.vx - b.item.vx;
                    const ky = a.item.vy - b.item.vy;
                    const totalMass = a.mass + b.mass;
                    const p = 2 * (nx * kx + ny * ky) / totalMass;

                    a.item.vx -= p * b.mass * nx;
                    a.item.vy -= p * b.mass * ny;
                    b.item.vx += p * a.mass * nx;
                    b.item.vy += p * a.mass * ny;

                    // Damping bounce loss
                    const e = 0.88; // matching client coin restitution
                    a.item.vx *= e;
                    a.item.vy *= e;
                    b.item.vx *= e;
                    b.item.vy *= e;
                }
            }
        }
    },

    checkWallCollisions: function() {
        const e = 0.82; // wall bounce damping matching client
        const minCoord = 48; // FRAME_BORDER
        const maxCoord = this.BOARD_SIZE - 48;

        const checkBounds = (item, radius) => {
            if (!item.active) return;
            // Left boundary
            if (item.x < minCoord + radius) {
                item.x = minCoord + radius;
                item.vx = -item.vx * e;
            }
            // Right boundary
            if (item.x > maxCoord - radius) {
                item.x = maxCoord - radius;
                item.vx = -item.vx * e;
            }
            // Top boundary
            if (item.y < minCoord + radius) {
                item.y = minCoord + radius;
                item.vy = -item.vy * e;
            }
            // Bottom boundary
            if (item.y > maxCoord - radius) {
                item.y = maxCoord - radius;
                item.vy = -item.vy * e;
            }
        };

        checkBounds(this.state.striker, this.STRIKER_RADIUS);
        this.state.coins.forEach(c => checkBounds(c, this.COIN_RADIUS));
    },

    checkPocketing: function() {
        const sinkCoin = (item, radius) => {
            if (!item.active) return false;
            for (let i = 0; i < this.POCKETS.length; i++) {
                const p = this.POCKETS[i];
                const dx = item.x - p.x;
                const dy = item.y - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                // Center of item must be inside pocket bounds
                if (dist < this.POCKET_RADIUS) {
                    item.active = false;
                    item.vx = 0;
                    item.vy = 0;
                    return true;
                }
            }
            return false;
        };

        // If striker is pocketed (foul)
        if (sinkCoin(this.state.striker, this.STRIKER_RADIUS)) {
            this.state.pocketedThisTurn.push('striker');
        }

        this.state.coins.forEach(c => {
            if (sinkCoin(c, this.COIN_RADIUS)) {
                this.state.pocketedThisTurn.push(c.type);
            }
        });
    },

    resolveTurnOutcome: function() {
        const activePlayerId = this.getCurrentPlayerId();
        const pColors = this.state.playerColors;
        const color = pColors[activePlayerId];
        
        let switchTurn = true;
        let penaltyPending = false;

        const hasStrikerFoul = this.state.pocketedThisTurn.includes('striker');
        const whiteSunk = this.state.pocketedThisTurn.filter(t => t === 'white').length;
        const blackSunk = this.state.pocketedThisTurn.filter(t => t === 'black').length;
        const queenSunk = this.state.pocketedThisTurn.includes('queen');

        // Points Mode vs Classic Mode scoring rules
        if (this.state.settings.preset === 'points') {
            let pts = 0;
            pts += whiteSunk * 2;
            pts += blackSunk * 1;
            if (queenSunk) pts += 3;
            
            if (hasStrikerFoul) {
                pts -= 1;
                this.state.scores[activePlayerId] = Math.max(0, this.state.scores[activePlayerId] + pts);
                switchTurn = true;
            } else if (whiteSunk > 0 || blackSunk > 0 || queenSunk) {
                this.state.scores[activePlayerId] += pts;
                switchTurn = false; // keeps turn
            }
        } else {
            // Classic Rules: Player 0 shoots White, Player 1 shoots Black (assigned by turn Index symmetry)
            // Even indexed turn order = White, Odd = Black
            const myCoinType = (this.state.currentTurnIndex % 2 === 0) ? 'white' : 'black';
            const oppCoinType = (myCoinType === 'white') ? 'black' : 'white';

            const myCoinsSunk = this.state.pocketedThisTurn.filter(t => t === myCoinType).length;
            const oppCoinsSunk = this.state.pocketedThisTurn.filter(t => t === oppCoinType).length;

            if (hasStrikerFoul) {
                // Striker pocketed foul - deduct score/pocketed coin if possible as penalty
                if (this.state.scores[activePlayerId] > 0) {
                    this.state.scores[activePlayerId]--;
                    this.respawnCoin(myCoinType);
                }
                switchTurn = true;
            } else {
                // Queen Cover logic check
                if (this.state.queenStatus === 'pocketed_pending_cover') {
                    if (myCoinsSunk > 0) {
                        // Covered successfully!
                        this.state.queenStatus = 'covered';
                        this.state.scores[this.state.queenPocketedBy] += 3; // Queen awards 3 points
                        this.state.scores[activePlayerId] += myCoinsSunk;
                        switchTurn = false;
                    } else {
                        // Failed to cover queen, respawn Queen
                        this.state.queenStatus = 'board';
                        this.respawnCoin('queen');
                        this.state.queenPocketedBy = null;
                        switchTurn = true;
                    }
                } else if (queenSunk) {
                    if (this.state.settings.queenRequired) {
                        this.state.queenStatus = 'pocketed_pending_cover';
                        this.state.queenPocketedBy = activePlayerId;
                        // Player keeps turn to try and cover the queen
                        switchTurn = false;
                    } else {
                        this.state.scores[activePlayerId] += 3;
                        switchTurn = false;
                    }
                } else if (myCoinsSunk > 0) {
                    this.state.scores[activePlayerId] += myCoinsSunk;
                    switchTurn = false; // keep turn since we pocketed our coin
                } else if (oppCoinsSunk > 0) {
                    // Pocketed opponent's coin, does not award turn, but opponent gets the point
                    const oppPlayerId = this.state.players.find(id => pColors[id] !== color);
                    if (oppPlayerId) {
                        this.state.scores[oppPlayerId] += oppCoinsSunk;
                    }
                    switchTurn = true;
                }
            }
        }

        // Verify victory (no coins left of a player's assigned color)
        if (this.checkWinCondition()) {
            this.state.status = 'finished';
            this.sync();
            return;
        }

        // Reset turn parameters
        this.state.shotCooldown = false;
        if (switchTurn) {
            this.advanceTurn();
        } else {
            this.resetStriker();
            this.resetTurnTimer();
        }
        this.sync();
    },

    respawnCoin: function(type) {
        // Place coin back in center circle
        const c = this.state.coins.find(coin => coin.type === type && !coin.active);
        if (c) {
            c.active = true;
            c.x = 400 + (Math.random() - 0.5) * 10;
            c.y = 400 + (Math.random() - 0.5) * 10;
            c.vx = 0;
            c.vy = 0;
        }
    },

    checkWinCondition: function() {
        if (this.state.settings.preset === 'points') {
            // Win when all white/black/queen are sunk
            const activeCoins = this.state.coins.filter(c => c.active);
            if (activeCoins.length === 0) {
                // Find highest score player
                let max = -1;
                let topId = null;
                this.state.players.forEach(id => {
                    if (this.state.scores[id] > max) {
                        max = this.state.scores[id];
                        topId = id;
                    }
                });
                this.state.winner = this.state.playerColors[topId];
                return true;
            }
        } else {
            // Classic rules: Win when your color coins are all pocketed
            const coinType = (this.state.currentTurnIndex % 2 === 0) ? 'white' : 'black';
            const remaining = this.state.coins.filter(c => c.type === coinType && c.active).length;
            if (remaining === 0 && (this.state.queenStatus === 'covered' || !this.state.settings.queenRequired)) {
                this.state.winner = this.state.playerColors[this.getCurrentPlayerId()];
                return true;
            }
        }
        return false;
    },

    advanceTurn: function() {
        this.state.currentTurnIndex = (this.state.currentTurnIndex + 1) % this.state.turnOrder.length;
        this.resetStriker();
        this.resetTurnTimer();
    },

    handleTimeout: function() {
        console.log("Turn timeout, shifting turn.");
        this.advanceTurn();
        this.sync();
    },

    sync: function() {
        Arcade.broadcastPublicState({
            status: this.state.status,
            turnOrder: this.state.turnOrder,
            currentTurnIndex: this.state.currentTurnIndex,
            playerColors: this.state.playerColors,
            scores: this.state.scores,
            striker: this.state.striker,
            coins: this.state.coins,
            simulating: this.state.simulating,
            shotCooldown: this.state.shotCooldown,
            winner: this.state.winner,
            queenStatus: this.state.queenStatus,
            timerRemaining: Math.ceil(this.state.timerRemaining)
        });
    }
};
