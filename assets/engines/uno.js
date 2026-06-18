/**
 * UNO AAA Authoritative Engine
 * Supports Official Rules + House Rules (Stacking, Jump-In, Seven-Zero)
 * Support Turn Timers & Multi-round Score limits
 */

const engine = {
    state: {
        deck: [],
        discardPile: [],
        hands: {},
        currentPlayerIndex: 0,
        direction: 1,
        currentColor: null,
        currentValue: null,
        status: 'waiting',
        winner: null,
        playerIds: [],
        drawPending: 0,
        round: 1,
        scores: {},
        timerRemaining: 0,
        settings: {
            startingHandSize: 7,
            scoreLimit: 500,
            turnTimer: 0, // 0 = disabled
            stacking: true,
            jumpIn: false,
            sevenZero: false,
            forcePlay: false,
            drawUntilPlayable: false
        }
    },

    onLoad: function() {
        console.log("UNO Engine loaded successfully.");
    },

    onInit: function(settings, players) {
        console.log("Initializing UNO Engine with settings:", JSON.stringify(settings));
        this.state.settings = { ...this.state.settings, ...settings };
        this.state.playerIds = players.map(p => p.id);
        this.state.unoDeclared = {};
        
        // Initialize scores
        this.state.scores = {};
        this.state.playerIds.forEach(id => {
            this.state.scores[id] = 0;
        });
        
        this.state.round = 1;
        this.state.winner = null;
        this.state.status = 'active';

        this.startRound();
    },

    startRound: function() {
        console.log("Starting UNO Round " + this.state.round);
        this.state.deck = this.createDeck();
        this.shuffle(this.state.deck);
        this.state.discardPile = [];
        this.state.drawPending = 0;
        this.state.unoDeclared = {};
        
        // Clear hands and deal cards
        this.state.playerIds.forEach(id => {
            this.state.hands[id] = [];
            for (let i = 0; i < this.state.settings.startingHandSize; i++) {
                this.state.hands[id].push(this.state.deck.pop());
            }
            console.log("Dealt " + this.state.settings.startingHandSize + " cards to player " + id);
        });

        // First card (non-wild to start simple)
        let firstCard = this.state.deck.pop();
        while (firstCard.color === 'Wild') {
            this.state.deck.unshift(firstCard);
            this.shuffle(this.state.deck);
            firstCard = this.state.deck.pop();
        }

        this.state.discardPile.push(firstCard);
        this.state.currentColor = firstCard.color;
        this.state.currentValue = firstCard.value;
        this.state.currentPlayerIndex = 0;
        this.state.direction = 1;
        
        this.resetTurnTimer();
        this.sync();
    },

    onAction: function(player, action) {
        console.log("Action received from player " + player.name + " (" + player.id + "):", JSON.stringify(action));
        if (this.state.status !== 'active') return;

        if (action.type === 'PLAY_CARD') {
            const isCurrent = player.id === this.state.playerIds[this.state.currentPlayerIndex];
            if (!isCurrent) {
                if (this.state.settings.jumpIn) {
                    this.handleJumpIn(player, action.data);
                } else {
                    console.log("It is not " + player.name + "'s turn. Blocked play.");
                }
                return;
            }
            this.handlePlay(player, action.data);
        } else if (action.type === 'DRAW_CARD') {
            const isCurrent = player.id === this.state.playerIds[this.state.currentPlayerIndex];
            if (!isCurrent) {
                console.log("Cannot draw: not " + player.name + "'s turn.");
                return;
            }
            this.handleDraw(player);
        } else if (action.type === 'DECLARE_UNO') {
            if (this.state.hands[player.id] && this.state.hands[player.id].length === 1) {
                this.state.unoDeclared[player.id] = true;
                console.log("Player " + player.name + " declared UNO!");
                this.sync();
            }
        } else if (action.type === 'CATCH_UNO') {
            const targetId = action.data.targetId;
            if (targetId && this.state.hands[targetId] && this.state.hands[targetId].length === 1 && !this.state.unoDeclared[targetId]) {
                console.log("Player " + player.name + " caught " + targetId + " not declaring UNO!");
                this.applyPenalty(targetId, 2);
                this.state.unoDeclared[targetId] = true;
                this.sync();
            }
        }
    },

    onTick: function(dt) {
        if (this.state.status !== 'active') return;
        if (this.state.settings.turnTimer > 0) {
            this.state.timerRemaining -= dt;
            if (this.state.timerRemaining <= 0) {
                console.log("Turn timer expired for current player.");
                this.handleTimeout();
            } else {
                // Sync status regularly so clients update countdown
                this.syncPublicOnly();
            }
        }
    },

    handleTimeout: function() {
        const currentId = this.state.playerIds[this.state.currentPlayerIndex];
        // Timeout: draw one card and pass turn
        console.log("Auto-drawing card due to timeout for " + currentId);
        this.drawOne(currentId);
        this.advanceTurn(1);
        this.resetTurnTimer();
        this.sync();
    },

    resetTurnTimer: function() {
        if (this.state.settings.turnTimer > 0) {
            this.state.timerRemaining = this.state.settings.turnTimer;
        } else {
            this.state.timerRemaining = 0;
        }
    },

    handlePlay: function(player, data) {
        this.closeCatchWindows(player.id);

        const hand = this.state.hands[player.id];
        if (!hand || data.cardIndex < 0 || data.cardIndex >= hand.length) return;

        const card = hand[data.cardIndex];

        // Match Logic
        let isMatch = card.color === 'Wild' ||
                      card.color === this.state.currentColor ||
                      card.value === this.state.currentValue;

        // Stacking Logic
        if (this.state.drawPending > 0) {
            if (!this.state.settings.stacking) {
                console.log("Draw penalty pending, stacking is disabled. Must draw.");
                return;
            }
            // Can stack DrawTwo on DrawTwo, or WildDrawFour on WildDrawFour, or WildDrawFour on DrawTwo (but not vice versa)
            const matchesPenalty = (card.value === 'DrawTwo' && this.state.currentValue === 'DrawTwo') ||
                                   (card.value === 'WildDrawFour');
            if (!matchesPenalty) {
                console.log("Cannot stack " + card.value + " on " + this.state.currentValue + ". Must stack penalty or draw.");
                return;
            }
        }

        if (!isMatch) {
            console.log("Card " + card.color + " " + card.value + " does not match top card " + this.state.currentColor + " " + this.state.currentValue);
            return;
        }

        // Apply Play
        hand.splice(data.cardIndex, 1);
        this.state.discardPile.push(card);
        this.state.currentValue = card.value;
        this.state.currentColor = (card.color === 'Wild') ? (data.chosenColor || 'Red') : card.color;

        console.log("Player " + player.name + " played " + card.color + " " + card.value + " (chosenColor=" + this.state.currentColor + ")");

        // Check hand size to open catch window
        if (hand.length === 1) {
            if (this.state.unoDeclared[player.id] !== true) {
                this.state.unoDeclared[player.id] = false;
            }
        } else {
            delete this.state.unoDeclared[player.id];
        }

        // Check Round Win
        if (hand.length === 0) {
            this.endRound(player.id);
            return;
        }

        // Seven-Zero Rules
        if (this.state.settings.sevenZero) {
            if (card.value === '0') {
                this.rotateHands();
            } else if (card.value === '7') {
                if (data.swapPlayerId && this.state.playerIds.includes(data.swapPlayerId) && data.swapPlayerId !== player.id) {
                    this.swapHands(player.id, data.swapPlayerId);
                } else {
                    // Default to next player
                    const nextId = this.getNextPlayerId();
                    this.swapHands(player.id, nextId);
                }
                // Check win after swap (if swapped player got 0 cards somehow? No, they swapped hands)
                if (this.state.hands[player.id].length === 0) {
                    this.endRound(player.id);
                    return;
                }
            }
        }

        // Special card effects
        let skip = false;
        if (card.value === 'Skip') skip = true;
        if (card.value === 'Reverse') {
            if (this.state.playerIds.length === 2) {
                skip = true;
            } else {
                this.state.direction *= -1;
                console.log("Direction reversed! Direction is now " + this.state.direction);
            }
        }

        if (card.value === 'DrawTwo') {
            this.state.drawPending += 2;
            if (!this.state.settings.stacking) {
                this.applyPenalty(this.getNextPlayerId(), this.state.drawPending);
                this.state.drawPending = 0;
                skip = true;
            }
        } else if (card.value === 'WildDrawFour') {
            this.state.drawPending += 4;
            if (!this.state.settings.stacking) {
                this.applyPenalty(this.getNextPlayerId(), this.state.drawPending);
                this.state.drawPending = 0;
                skip = true;
            }
        }

        this.advanceTurn(skip ? 2 : 1);
        this.resetTurnTimer();
        this.sync();
    },

    handleJumpIn: function(player, data) {
        const hand = this.state.hands[player.id];
        if (!hand || data.cardIndex < 0 || data.cardIndex >= hand.length) return;

        const card = hand[data.cardIndex];
        const topCard = this.state.discardPile[this.state.discardPile.length - 1];

        // Jump-in is only valid if matching BOTH color and value exactly
        if (card.color === topCard.color && card.value === topCard.value) {
            console.log("Jump-in triggered by " + player.name + " (" + player.id + ")");
            const newIdx = this.state.playerIds.indexOf(player.id);
            if (newIdx !== -1) {
                this.state.currentPlayerIndex = newIdx;
                this.handlePlay(player, data);
            }
        }
    },

    handleDraw: function(player) {
        this.closeCatchWindows(player.id);
        delete this.state.unoDeclared[player.id];

        if (this.state.drawPending > 0) {
            console.log("Drawing " + this.state.drawPending + " penalty cards for player " + player.id);
            this.applyPenalty(player.id, this.state.drawPending);
            this.state.drawPending = 0;
            this.advanceTurn(1);
        } else {
            const card = this.drawOne(player.id);
            if (!card) {
                console.log("No cards left to draw.");
                this.advanceTurn(1);
                this.resetTurnTimer();
                this.sync();
                return;
            }
            console.log("Player " + player.id + " drew normal card: " + card.color + " " + card.value);

            if (this.state.settings.drawUntilPlayable) {
                let playable = this.isPlayable(card);
                while (!playable) {
                    const next = this.drawOne(player.id);
                    if (!next) {
                        console.log("No cards left to draw during drawUntilPlayable loop.");
                        break;
                    }
                    playable = this.isPlayable(next);
                    console.log("Drew extra card: " + next.color + " " + next.value + " (playable=" + playable + ")");
                }
            }

            // If forcePlay is false, player can choose not to play the card. We advance turn.
            if (!this.state.settings.forcePlay) {
                this.advanceTurn(1);
            } else {
                // If forcePlay is true, if the card drawn is playable, it must be played immediately!
                // Wait! To keep it simple, we just check if it's playable. If so, let them play it,
                // or if it's not playable, we advance turn.
                if (!this.isPlayable(card)) {
                    this.advanceTurn(1);
                }
            }
        }
        this.resetTurnTimer();
        this.sync();
    },

    isPlayable: function(card) {
        return card.color === 'Wild' ||
               card.color === this.state.currentColor ||
               card.value === this.state.currentValue;
    },

    drawOne: function(playerId) {
        if (this.state.deck.length === 0) this.recycleDiscard();
        const card = this.state.deck.pop();
        if (card) {
            this.state.hands[playerId].push(card);
        }
        return card;
    },

    applyPenalty: function(playerId, count) {
        for (let i = 0; i < count; i++) {
            this.drawOne(playerId);
        }
    },

    recycleDiscard: function() {
        console.log("Recycling discard pile...");
        const top = this.state.discardPile.pop();
        this.state.deck = [...this.state.discardPile];
        this.shuffle(this.state.deck);
        this.state.discardPile = [top];
    },

    advanceTurn: function(steps) {
        const n = this.state.playerIds.length;
        this.state.currentPlayerIndex = (this.state.currentPlayerIndex + (this.state.direction * steps) + n) % n;
        console.log("Turn advanced to: player " + this.state.playerIds[this.state.currentPlayerIndex]);
    },

    getNextPlayerId: function() {
        const n = this.state.playerIds.length;
        const idx = (this.state.currentPlayerIndex + this.state.direction + n) % n;
        return this.state.playerIds[idx];
    },

    rotateHands: function() {
        const n = this.state.playerIds.length;
        const tempHands = {};
        this.state.playerIds.forEach(id => {
            tempHands[id] = [...this.state.hands[id]];
        });

        for (let i = 0; i < n; i++) {
            const currentId = this.state.playerIds[i];
            const targetIdx = (i + this.state.direction + n) % n;
            const targetId = this.state.playerIds[targetIdx];
            this.state.hands[targetId] = tempHands[currentId];
        }
        console.log("Hands rotated!");

        this.state.playerIds.forEach(id => {
            if (this.state.hands[id].length === 1) {
                this.state.unoDeclared[id] = false;
            } else {
                delete this.state.unoDeclared[id];
            }
        });
    },

    swapHands: function(p1, p2) {
        const temp = this.state.hands[p1];
        this.state.hands[p1] = this.state.hands[p2];
        this.state.hands[p2] = temp;
        console.log("Hands swapped between " + p1 + " and " + p2);

        [p1, p2].forEach(id => {
            if (this.state.hands[id].length === 1) {
                this.state.unoDeclared[id] = false;
            } else {
                delete this.state.unoDeclared[id];
            }
        });
    },

    endRound: function(winnerId) {
        let roundScore = 0;
        this.state.playerIds.forEach(id => {
            if (id === winnerId) return;
            const hand = this.state.hands[id];
            hand.forEach(card => {
                if (card.color === 'Wild') {
                    roundScore += 50;
                } else if (card.value === 'DrawTwo' || card.value === 'Skip' || card.value === 'Reverse') {
                    roundScore += 20;
                } else {
                    roundScore += parseInt(card.value) || 0;
                }
            });
        });

        this.state.scores[winnerId] += roundScore;
        console.log("Round ended! Winner: " + winnerId + " (+ " + roundScore + " pts). Total score: " + this.state.scores[winnerId]);

        const limit = this.state.settings.scoreLimit || 500;
        if (this.state.scores[winnerId] >= limit) {
            this.state.status = 'finished';
            this.state.winner = winnerId;
            console.log("Game finished! Grand winner: " + winnerId);
        } else {
            this.state.round++;
            this.startRound();
        }
    },

    validateState: function() {
        let invalid = false;

        if (this.state.currentPlayerIndex < 0 || this.state.currentPlayerIndex >= this.state.playerIds.length) {
            console.error("validateState failed: currentPlayerIndex out of bounds (" + this.state.currentPlayerIndex + ")");
            this.state.currentPlayerIndex = 0;
            invalid = true;
        }

        for (let id in this.state.scores) {
            if (isNaN(this.state.scores[id])) {
                console.error("validateState failed: NaN score for player " + id);
                this.state.scores[id] = 0;
                invalid = true;
            }
        }
        if (isNaN(this.state.timerRemaining) || this.state.timerRemaining < 0) {
            this.state.timerRemaining = 0;
            invalid = true;
        }

        for (let id in this.state.hands) {
            if (this.state.hands[id]) {
                const prevLen = this.state.hands[id].length;
                this.state.hands[id] = this.state.hands[id].filter(c => c && c.color && c.value);
                if (this.state.hands[id].length !== prevLen) {
                    console.error("validateState failed: hand for player " + id + " contained null/undefined cards");
                    invalid = true;
                }
            } else {
                this.state.hands[id] = [];
                invalid = true;
            }
        }

        const uniquePlayers = [...new Set(this.state.playerIds)];
        if (uniquePlayers.length !== this.state.playerIds.length) {
            console.error("validateState failed: duplicate player IDs found");
            this.state.playerIds = uniquePlayers;
            invalid = true;
        }

        return !invalid;
    },

    closeCatchWindows: function(exceptPlayerId) {
        this.state.playerIds.forEach(id => {
            if (id !== exceptPlayerId && this.state.hands[id] && this.state.hands[id].length === 1) {
                this.state.unoDeclared[id] = true;
            }
        });
    },

    syncPublicOnly: function() {
        this.validateState();
        const publicState = {
            topCard: this.state.discardPile[this.state.discardPile.length - 1],
            currentColor: this.state.currentColor,
            currentValue: this.state.currentValue,
            currentPlayerId: this.state.playerIds[this.state.currentPlayerIndex],
            direction: this.state.direction,
            status: this.state.status,
            winner: this.state.winner,
            drawPending: this.state.drawPending,
            round: this.state.round,
            scores: this.state.scores,
            timerRemaining: this.state.timerRemaining,
            turnTimer: this.state.settings.turnTimer,
            settings: this.state.settings,
            playerCardCounts: {},
            unoDeclared: this.state.unoDeclared
        };
        this.state.playerIds.forEach(id => {
            publicState.playerCardCounts[id] = this.state.hands[id] ? this.state.hands[id].length : 0;
        });

        Arcade.broadcastPublicState(publicState);
    },

    sync: function() {
        this.syncPublicOnly();

        this.state.playerIds.forEach(id => {
            if (this.state.hands[id]) {
                Arcade.sendPrivateState(id, { hand: this.state.hands[id] });
            }
        });
    },

    createDeck: function() {
        const colors = ['Red', 'Blue', 'Green', 'Yellow'];
        const values = ['0','1','2','3','4','5','6','7','8','9','Skip','Reverse','DrawTwo'];
        let deck = [];
        colors.forEach(c => {
            values.forEach(v => {
                deck.push({ color: c, value: v });
                if (v !== '0') deck.push({ color: c, value: v });
            });
        });
        for (let i = 0; i < 4; i++) {
            deck.push({ color: 'Wild', value: 'Wild' });
            deck.push({ color: 'Wild', value: 'WildDrawFour' });
        }
        return deck;
    },

    shuffle: function(a) {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
    }
};
