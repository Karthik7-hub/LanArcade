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
        this.state.finishedPlayers = [];
        this.state.placements = [];
        
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
        this.state.finishedPlayers = [];
        this.state.placements = [];
        
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
        this.checkOfflinePlayerTurn();
        this.sync();
    },

    checkOfflinePlayerTurn: function() {
        if (this.state.status !== 'active') return;
        
        // Count active online players
        const activeOnlinePlayers = this.state.playerIds.filter(id => 
            (!this.state.offlinePlayers || !this.state.offlinePlayers.includes(id)) && 
            !this.state.finishedPlayers.includes(id)
        );
        
        if (activeOnlinePlayers.length === 0) {
            console.log("No online players left. Suspending automatic offline turns.");
            return;
        }

        const currentId = this.state.playerIds[this.state.currentPlayerIndex];
        if (this.state.offlinePlayers && this.state.offlinePlayers.includes(currentId)) {
            console.log("Current player " + currentId + " is offline. Auto-drawing a card in their absence.");
            
            // Draw a card for the offline player
            if (this.state.drawPending > 0) {
                this.applyPenalty(currentId, this.state.drawPending);
                this.state.drawPending = 0;
            } else {
                this.drawOne(currentId);
            }
            
            // Advance turn, which will call checkOfflinePlayerTurn again if the next player is offline
            this.advanceTurn(1);
        }
    },

    onPlayerLeave: function(player) {
        console.log("onPlayerLeave called for player: " + player.id);
        
        if (this.state.status === 'active') {
            if (!this.state.offlinePlayers) this.state.offlinePlayers = [];
            if (!this.state.offlinePlayers.includes(player.id)) {
                this.state.offlinePlayers.push(player.id);
                console.log("Player " + player.id + " marked as offline in active game.");
            }
            this.checkOfflinePlayerTurn();
            return;
        }

        const index = this.state.playerIds.indexOf(player.id);
        if (index === -1) return;

        const wasCurrentPlayer = (index === this.state.currentPlayerIndex);
        let nextPlayerId = null;
        if (wasCurrentPlayer) {
            nextPlayerId = this.getNextPlayerId();
        }

        // Save hand and score to offline storage for potential reconnect
        if (!this.state.offlineHands) this.state.offlineHands = {};
        if (!this.state.offlineScores) this.state.offlineScores = {};

        if (this.state.hands[player.id]) {
            this.state.offlineHands[player.id] = this.state.hands[player.id];
            delete this.state.hands[player.id];
        }
        if (this.state.scores[player.id] !== undefined) {
            this.state.offlineScores[player.id] = this.state.scores[player.id];
            delete this.state.scores[player.id];
        }
        
        if (this.state.unoDeclared) delete this.state.unoDeclared[player.id];
        this.state.finishedPlayers = (this.state.finishedPlayers || []).filter(id => id !== player.id);

        // Remove from playerIds
        this.state.playerIds.splice(index, 1);

        // Check if game is finished (less than 2 players left)
        const activePlayers = this.state.playerIds.filter(id => !this.state.finishedPlayers.includes(id));
        if (this.state.playerIds.length < 2 || activePlayers.length <= 1) {
            this.state.status = 'finished';
            if (activePlayers.length === 1) {
                this.state.winner = activePlayers[0];
            } else if (this.state.playerIds.length > 0) {
                this.state.winner = this.state.playerIds[0];
            } else {
                this.state.winner = null;
            }
            this.sync();
            return;
        }

        // Update currentPlayerIndex
        if (wasCurrentPlayer && nextPlayerId) {
            const newIdx = this.state.playerIds.indexOf(nextPlayerId);
            this.state.currentPlayerIndex = newIdx !== -1 ? newIdx : 0;
            this.resetTurnTimer();
        } else {
            if (index < this.state.currentPlayerIndex) {
                this.state.currentPlayerIndex--;
            }
            if (this.state.currentPlayerIndex >= this.state.playerIds.length) {
                this.state.currentPlayerIndex = 0;
            }
        }

        this.sync();
    },

    onPlayerJoin: function(player) {
        console.log("onPlayerJoin called for player: " + player.id);
        if (this.state.offlinePlayers) {
            this.state.offlinePlayers = this.state.offlinePlayers.filter(id => id !== player.id);
        }
        if (!this.state.playerIds.includes(player.id)) {
            this.state.playerIds.push(player.id);
        }
        
        if (this.state.offlineHands && this.state.offlineHands[player.id]) {
            this.state.hands[player.id] = this.state.offlineHands[player.id];
            delete this.state.offlineHands[player.id];
        } else if (!this.state.hands[player.id]) {
            this.state.hands[player.id] = [];
        }
        
        if (this.state.offlineScores && this.state.offlineScores[player.id] !== undefined) {
            this.state.scores[player.id] = this.state.offlineScores[player.id];
            delete this.state.offlineScores[player.id];
        } else if (this.state.scores[player.id] === undefined) {
            this.state.scores[player.id] = 0;
        }
        
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
        // Timeout: draw penalty cards if any are pending, otherwise draw one card
        console.log("Auto-drawing card due to timeout for " + currentId);
        if (this.state.drawPending > 0) {
            this.applyPenalty(currentId, this.state.drawPending);
            this.state.drawPending = 0;
        } else {
            this.drawOne(currentId);
        }
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
            // Can stack ONLY matching penalty cards (+2 on +2, +4 on +4) on top of a pending draw penalty
            const matchesPenalty = card.value === this.state.currentValue;
            if (!matchesPenalty) {
                console.log("Cannot stack " + card.value + " on " + this.state.currentValue + ". Must stack penalty or draw.");
                return;
            }
            isMatch = true; // Bypass normal color/value match check since stack is valid
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

        // Check Win/Placement
        if (this.checkWinState(player.id)) {
            this.sync();
            return;
        }

        // Seven-Zero Rules
        if (this.state.settings.sevenZero) {
            if (card.value === '0') {
                this.rotateHands();
            } else if (card.value === '7') {
                const targetId = (data.swapPlayerId && this.state.playerIds.includes(data.swapPlayerId) && data.swapPlayerId !== player.id)
                    ? data.swapPlayerId
                    : this.getNextPlayerId();
                
                this.swapHands(player.id, targetId);

                // Check win states for both players involved in the swap
                const p1Finished = this.checkWinState(player.id);
                const p2Finished = this.checkWinState(targetId);
                
                if (p1Finished || p2Finished) {
                    if (this.state.status === 'finished') {
                        this.sync();
                        return;
                    }
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
        let index = this.state.currentPlayerIndex;
        index = (index + (this.state.direction * steps) + n) % n;
        
        let attempts = 0;
        while (this.state.finishedPlayers.includes(this.state.playerIds[index]) && attempts < n) {
            index = (index + this.state.direction + n) % n;
            attempts++;
        }
        
        this.state.currentPlayerIndex = index;
        console.log("Turn advanced to: player " + this.state.playerIds[this.state.currentPlayerIndex]);
        
        this.checkOfflinePlayerTurn();
    },

    getNextPlayerId: function() {
        const n = this.state.playerIds.length;
        let idx = (this.state.currentPlayerIndex + this.state.direction + n) % n;
        let attempts = 0;
        while (this.state.finishedPlayers.includes(this.state.playerIds[idx]) && attempts < n) {
            idx = (idx + this.state.direction + n) % n;
            attempts++;
        }
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

    checkWinState: function(playerId) {
        const hand = this.state.hands[playerId];
        if (hand && hand.length === 0) {
            if (!this.state.finishedPlayers.includes(playerId)) {
                this.state.finishedPlayers.push(playerId);
                console.log("Player " + playerId + " finished at placement " + this.state.finishedPlayers.length);
            }

            const activePlayers = this.state.playerIds.filter(id => !this.state.finishedPlayers.includes(id));
            if (activePlayers.length <= 1) {
                if (activePlayers.length === 1 && !this.state.finishedPlayers.includes(activePlayers[0])) {
                    this.state.finishedPlayers.push(activePlayers[0]);
                }
                this.state.status = 'finished';
                this.state.winner = this.state.finishedPlayers[0];
                console.log("Game finished! placements: " + JSON.stringify(this.state.finishedPlayers));
                return true;
            }
        }
        return false;
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
            unoDeclared: this.state.unoDeclared,
            finishedPlayers: this.state.finishedPlayers || [],
            offlinePlayers: this.state.offlinePlayers || []
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
