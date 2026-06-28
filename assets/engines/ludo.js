/**
 * Ludo Classic Authoritative JS Engine
 * Supports 2-4 Players, Custom presets, Safe Zones, Replay logs, and Offline Auto-Turns.
 */

const engine = {
    config: {
        tickRate: 2 // 2 Hz for turn timer checks
    },

    state: {
        status: 'waiting', // waiting, active, finished
        players: [], // array of player IDs
        playerColors: {}, // map of playerId -> color (red, green, yellow, blue)
        turnOrder: [], // color order: red, green, yellow, blue
        currentTurnIndex: 0, // index in turnOrder
        diceValue: null,
        diceRolled: false,
        consecutiveSixes: 0,
        winner: null,
        rankings: [], // finished players
        tokens: {}, // map of playerId -> array of { id, step, at, pos }
        replayLog: [], // recent moves log
        timerRemaining: 0,
        settings: {
            tokensPerPlayer: 4,
            sixRollsAgain: true,
            threeSixesSkip: true,
            safeZonesProtected: true
        }
    },

    // Color definitions
    COLORS: ['red', 'green', 'yellow', 'blue'],
    START_TILES: { red: 0, green: 13, yellow: 26, blue: 39 },

    onLoad: function() {
        console.log("Ludo Engine loaded.");
    },

    onInit: function(settings, players) {
        console.log("Initializing Ludo with players:", JSON.stringify(players));
        this.state.settings = { ...this.state.settings, ...settings };
        
        // 2-4 players supported. Let's setup colors.
        this.state.players = players.map(p => p.id);
        this.state.playerColors = {};
        this.state.turnOrder = [];
        this.state.rankings = [];
        this.state.winner = null;
        this.state.diceValue = null;
        this.state.diceRolled = false;
        this.state.consecutiveSixes = 0;
        this.state.replayLog = ["Game Started! Good luck."];

        players.forEach((p, idx) => {
            const color = this.COLORS[idx];
            this.state.playerColors[p.id] = color;
            this.state.turnOrder.push(color);
            
            // Initialize tokens for this player
            this.state.tokens[p.id] = [];
            for (let i = 0; i < this.state.settings.tokensPerPlayer; i++) {
                this.state.tokens[p.id].push({
                    id: i,
                    step: -1, // -1 means in Yard / Base
                    at: 'base',
                    pos: -1
                });
            }
        });

        this.state.currentTurnIndex = 0;
        this.state.status = 'active';
        this.resetTurnTimer();
        this.sync();
    },

    onPlayerJoin: function(player) {
        console.log("Player reconnected: " + player.id);
        // Remove from offline list if tracked
        if (this.state.offlinePlayers) {
            this.state.offlinePlayers = this.state.offlinePlayers.filter(id => id !== player.id);
        }
        this.sync();
    },

    onPlayerLeave: function(player) {
        console.log("Player disconnected: " + player.id);
        if (!this.state.offlinePlayers) this.state.offlinePlayers = [];
        if (!this.state.offlinePlayers.includes(player.id)) {
            this.state.offlinePlayers.push(player.id);
        }
        this.sync();
    },

    onTick: function(dt) {
        if (this.state.status !== 'active') return;

        if (this.state.timerRemaining > 0) {
            this.state.timerRemaining -= dt;
            if (this.state.timerRemaining <= 0) {
                this.state.timerRemaining = 0;
                this.handleAutoTurn();
            }
        }
    },

    resetTurnTimer: function() {
        this.state.timerRemaining = 30; // 30 seconds per turn
    },

    getCurrentPlayerId: function() {
        const currentColor = this.state.turnOrder[this.state.currentTurnIndex];
        return this.state.players.find(id => this.state.playerColors[id] === currentColor);
    },

    onAction: function(player, action) {
        if (this.state.status !== 'active') return;

        const activePlayerId = this.getCurrentPlayerId();
        if (player.id !== activePlayerId) {
            console.log("Action rejected: Not player's turn.");
            return;
        }

        switch (action.type) {
            case 'roll_dice':
                this.handleRoll(activePlayerId);
                break;
            case 'move_token':
                this.handleMove(activePlayerId, action.data.tokenId);
                break;
        }
    },

    handleRoll: function(playerId) {
        if (this.state.diceRolled) {
            console.log("Already rolled.");
            return;
        }

        const color = this.state.playerColors[playerId];
        const roll = Math.floor(Math.random() * 6) + 1;
        this.state.diceValue = roll;
        this.state.diceRolled = true;

        this.logEvent(`${color.toUpperCase()} rolled a ${roll}!`);

        // Check if consecutive sixes limit reached
        if (roll === 6) {
            this.state.consecutiveSixes++;
            if (this.state.settings.threeSixesSkip && this.state.consecutiveSixes === 3) {
                this.logEvent("Three 6s in a row! Turn skipped.");
                this.advanceTurn();
                return;
            }
        } else {
            this.state.consecutiveSixes = 0;
        }

        // Determine movable tokens
        const movable = this.getMovableTokens(playerId, roll);
        if (movable.length === 0) {
            this.logEvent("No legal moves available.");
            // If they rolled a 6, they roll again, otherwise advance turn
            if (roll === 6 && this.state.settings.sixRollsAgain) {
                this.state.diceRolled = false;
                this.resetTurnTimer();
            } else {
                setTimeout(() => {
                    this.advanceTurn();
                }, 1500); // Small delay so they see the roll
            }
        } else {
            this.resetTurnTimer();
        }
        this.sync();
    },

    getMovableTokens: function(playerId, roll) {
        const tokens = this.state.tokens[playerId];
        const movable = [];

        tokens.forEach(t => {
            if (t.step === -1) {
                // To exit base, must roll 6
                if (roll === 6) {
                    movable.push(t.id);
                }
            } else if (t.step + roll <= 56) {
                // Must not overshoot the home cell (56)
                movable.push(t.id);
            }
        });

        return movable;
    },

    handleMove: function(playerId, tokenId) {
        if (!this.state.diceRolled) {
            console.log("Must roll first.");
            return;
        }

        const roll = this.state.diceValue;
        const color = this.state.playerColors[playerId];
        const tokens = this.state.tokens[playerId];
        const token = tokens.find(t => t.id === tokenId);

        if (!token) return;

        // Verify if move is valid
        const movable = this.getMovableTokens(playerId, roll);
        if (!movable.includes(tokenId)) {
            console.log("Token cannot move.");
            return;
        }

        let extraTurnAwarded = false;

        if (token.step === -1) {
            // Releasing from base
            token.step = 0;
            token.at = 'track';
            token.pos = this.START_TILES[color];
            this.logEvent(`${color.toUpperCase()} released token #${tokenId + 1}`);
        } else {
            // Move token step-by-step
            const startStep = token.step;
            token.step += roll;
            
            if (token.step === 56) {
                token.at = 'home';
                token.pos = 100; // special coordinate indicator for home center
                this.logEvent(`${color.toUpperCase()}'s token #${tokenId + 1} reached Home!`);
                
                // Award extra turn for reaching home
                extraTurnAwarded = true;
            } else if (token.step > 50) {
                token.at = 'homepath';
                // Home paths are specific index per color, step is relative 51-55 (mapped to 0-4)
                token.pos = token.step - 51;
            } else {
                token.at = 'track';
                token.pos = (this.START_TILES[color] + token.step) % 52;
                
                // Check capture
                const captureSuccess = this.checkCapture(playerId, token.pos);
                if (captureSuccess) {
                    extraTurnAwarded = true;
                }
            }
        }

        // Check victory
        if (this.checkPlayerFinished(playerId)) {
            if (!this.state.rankings.includes(color)) {
                this.state.rankings.push(color);
                this.logEvent(`${color.toUpperCase()} has finished all tokens!`);
            }
            
            // Check if game is complete
            const activeColorsCount = this.state.turnOrder.length - this.state.rankings.length;
            if (activeColorsCount <= 1 || this.state.rankings.length === this.state.turnOrder.length) {
                this.state.status = 'finished';
                this.state.winner = this.state.rankings[0];
                this.logEvent(`Game Finished! Winner is ${this.state.winner.toUpperCase()}!`);
                this.sync();
                return;
            }
        }

        // Clean up turn state
        this.state.diceRolled = false;
        this.state.diceValue = null;

        // Roll again if they rolled a 6 or got an extra turn
        if ((roll === 6 && this.state.settings.sixRollsAgain) || extraTurnAwarded) {
            this.state.consecutiveSixes = (roll === 6) ? this.state.consecutiveSixes : 0;
            this.resetTurnTimer();
            this.logEvent(`Extra roll for ${color.toUpperCase()}!`);
        } else {
            this.state.consecutiveSixes = 0;
            this.advanceTurn();
        }

        this.sync();
    },

    checkCapture: function(attackerId, trackPos) {
        // Star tiles/safe zones
        const safeTiles = [0, 8, 13, 21, 26, 34, 39, 47];
        if (this.state.settings.safeZonesProtected && safeTiles.includes(trackPos)) {
            return false;
        }

        const attackerColor = this.state.playerColors[attackerId];
        let captured = false;

        this.state.players.forEach(otherId => {
            if (otherId === attackerId) return;
            const otherColor = this.state.playerColors[otherId];
            const otherTokens = this.state.tokens[otherId];

            otherTokens.forEach(t => {
                if (t.at === 'track' && t.pos === trackPos) {
                    // Reset opponent token to yard
                    t.step = -1;
                    t.at = 'base';
                    t.pos = -1;
                    captured = true;
                    this.logEvent(`${attackerColor.toUpperCase()} captured ${otherColor.toUpperCase()}'s token #${t.id + 1}!`);
                }
            });
        });

        return captured;
    },

    checkPlayerFinished: function(playerId) {
        const tokens = this.state.tokens[playerId];
        return tokens.every(t => t.at === 'home');
    },

    advanceTurn: function() {
        this.state.diceRolled = false;
        this.state.diceValue = null;
        this.state.consecutiveSixes = 0;

        let nextIndex = this.state.currentTurnIndex;
        do {
            nextIndex = (nextIndex + 1) % this.state.turnOrder.length;
            const nextColor = this.state.turnOrder[nextIndex];
            
            // Skip players who have finished
            if (!this.state.rankings.includes(nextColor)) {
                this.state.currentTurnIndex = nextIndex;
                this.resetTurnTimer();
                this.sync();
                return;
            }
        } while (nextIndex !== this.state.currentTurnIndex);
    },

    handleAutoTurn: function() {
        const activePlayerId = this.getCurrentPlayerId();
        const color = this.state.playerColors[activePlayerId];
        this.logEvent(`${color.toUpperCase()} turn timed out. Auto-rolling...`);

        // If they need to roll, auto roll
        if (!this.state.diceRolled) {
            const roll = Math.floor(Math.random() * 6) + 1;
            this.state.diceValue = roll;
            this.state.diceRolled = true;
            this.logEvent(`Auto-rolled a ${roll}`);

            const movable = this.getMovableTokens(activePlayerId, roll);
            if (movable.length > 0) {
                // Auto-move first movable token
                this.handleMove(activePlayerId, movable[0]);
            } else {
                this.advanceTurn();
            }
        } else {
            // Already rolled but timed out choosing piece
            const roll = this.state.diceValue;
            const movable = this.getMovableTokens(activePlayerId, roll);
            if (movable.length > 0) {
                this.handleMove(activePlayerId, movable[0]);
            } else {
                this.advanceTurn();
            }
        }
    },

    logEvent: function(msg) {
        this.state.replayLog.unshift(msg);
        if (this.state.replayLog.length > 15) {
            this.state.replayLog.pop();
        }
    },

    sync: function() {
        // Broadcast public state
        Arcade.broadcastPublicState({
            status: this.state.status,
            turnOrder: this.state.turnOrder,
            currentTurnIndex: this.state.currentTurnIndex,
            playerColors: this.state.playerColors,
            diceValue: this.state.diceValue,
            diceRolled: this.state.diceRolled,
            winner: this.state.winner,
            rankings: this.state.rankings,
            tokens: this.state.tokens,
            replayLog: this.state.replayLog,
            timerRemaining: Math.ceil(this.state.timerRemaining)
        });
    }
};
