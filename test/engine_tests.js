const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert');
const test = require('node:test');

// Helper to load and initialize a JS engine in a mocked sandbox
function loadEngine(filePath, mockArcade = {}) {
    const code = fs.readFileSync(filePath, 'utf8');
    
    // Create sandbox mimicking flutter_js bridge
    const sandbox = {
        console: {
            log: (...args) => {
                // Uncomment to debug console logs from inside JS engines
                // console.log('[Sandbox Log]', ...args);
            },
            error: (...args) => {
                console.error('[Sandbox Error]', ...args);
            }
        },
        Arcade: {
            broadcastPublicState: () => {},
            sendPrivateState: () => {},
            unlockAchievement: () => {},
            ...mockArcade
        },
        sendMessage: (msg, args) => {
            // Emulate consoleLog channel
            if (msg === 'consoleLog') {
                const parsed = JSON.parse(args);
                // console.log('[ConsoleLog Bridge]', parsed);
            }
        }
    };
    
    vm.createContext(sandbox);
    
    // Run engine code and explicitly attach to globalThis so it is visible to other evaluations
    const fullCode = code + "\n; globalThis.engine = engine;";
    vm.runInContext(fullCode, sandbox);
    
    // Inject defaults as done in js_engine.dart
    vm.runInContext(`
        if (typeof engine === 'undefined') {
            engine = {};
        }
        var defaults = {
            onLoad: function() {},
            onInit: function(settings, players) {},
            onAction: function(player, action) {},
            onPlayerJoin: function(player) {},
            onPlayerLeave: function(player) {},
            onPause: function() {},
            onResume: function() {},
            onTick: function(dt) {},
            onDestroy: function() {}
        };
        for (var key in defaults) {
            if (typeof engine[key] === 'undefined') {
                engine[key] = defaults[key];
            }
        }
    `, sandbox);
    
    return sandbox.engine;
}

test('UNO - Deck Composition & Creation', () => {
    const engine = loadEngine('assets/engines/uno.js');
    const deck = engine.createDeck();
    
    assert.strictEqual(deck.length, 108, 'UNO deck must have exactly 108 cards');
    
    // Count colors
    const counts = { Red: 0, Blue: 0, Green: 0, Yellow: 0, Wild: 0 };
    deck.forEach(c => counts[c.color]++);
    
    assert.strictEqual(counts.Wild, 8, 'UNO deck must have 8 Wild cards (4 Wild + 4 WildDrawFour)');
    assert.strictEqual(counts.Red, 25, 'UNO deck must have 25 Red cards (1 zero + 2 * nine numbers + 2 skip + 2 reverse + 2 draw two)');
    assert.strictEqual(counts.Blue, 25, 'UNO deck must have 25 Blue cards');
    assert.strictEqual(counts.Green, 25, 'UNO deck must have 25 Green cards');
    assert.strictEqual(counts.Yellow, 25, 'UNO deck must have 25 Yellow cards');
});

test('UNO - Game Initialization and Dealing', () => {
    let publicBroadcasts = [];
    let privateMessages = [];
    
    const mockArcade = {
        broadcastPublicState: (state) => {
            publicBroadcasts.push(state);
        },
        sendPrivateState: (playerId, state) => {
            privateMessages.push({ playerId, state });
        }
    };
    
    const engine = loadEngine('assets/engines/uno.js', mockArcade);
    
    const players = [
        { id: 'player1', name: 'Alice', isHost: true },
        { id: 'player2', name: 'Bob', isHost: false }
    ];
    
    const settings = {
        startingHandSize: 7,
        scoreLimit: 250
    };
    
    engine.onInit(settings, players);
    
    assert.strictEqual(engine.state.status, 'active');
    assert.strictEqual(engine.state.round, 1);
    assert.strictEqual(engine.state.playerIds.length, 2);
    
    // Check hand sizes
    assert.strictEqual(engine.state.hands['player1'].length, 7);
    assert.strictEqual(engine.state.hands['player2'].length, 7);
    
    // Check deck reduced appropriately: 108 - 14 (hands) - 1 (first discard) = 93
    assert.strictEqual(engine.state.deck.length, 93);
    
    // Discard pile must have 1 card
    assert.strictEqual(engine.state.discardPile.length, 1);
    assert.notStrictEqual(engine.state.discardPile[0].color, 'Wild');
    
    // Check initial broadcast
    assert.ok(publicBroadcasts.length > 0);
    const lastPublic = publicBroadcasts[publicBroadcasts.length - 1];
    assert.strictEqual(lastPublic.status, 'active');
    assert.strictEqual(lastPublic.playerCardCounts['player1'], 7);
    assert.strictEqual(lastPublic.playerCardCounts['player2'], 7);
    
    // Check private messages
    assert.ok(privateMessages.some(m => m.playerId === 'player1'));
    assert.ok(privateMessages.some(m => m.playerId === 'player2'));
});

test('UNO - Turn Rotation and Reverse/Skip', () => {
    const engine = loadEngine('assets/engines/uno.js');
    const players = [
        { id: 'player1', name: 'Alice' },
        { id: 'player2', name: 'Bob' },
        { id: 'player3', name: 'Charlie' }
    ];
    engine.onInit({ startingHandSize: 5 }, players);
    
    // Set fixed hands & top card for predictability
    // Give Alice, Bob, and Charlie at least 5 cards so playing one doesn't win the round
    engine.state.hands['player1'] = [
        { color: 'Red', value: 'Skip' },
        { color: 'Blue', value: 'Reverse' },
        { color: 'Red', value: '5' },
        { color: 'Red', value: '9' },
        { color: 'Red', value: '8' }
    ];
    engine.state.hands['player2'] = [
        { color: 'Red', value: '3' },
        { color: 'Yellow', value: '2' },
        { color: 'Green', value: '4' }
    ];
    engine.state.hands['player3'] = [
        { color: 'Blue', value: '8' },
        { color: 'Blue', value: '7' },
        { color: 'Blue', value: '6' }
    ];
    engine.state.discardPile = [{ color: 'Red', value: '7' }];
    engine.state.currentColor = 'Red';
    engine.state.currentValue = '7';
    engine.state.currentPlayerIndex = 0; // player1's turn
    engine.state.direction = 1;
    
    // 1. Play normal card Red 5 (card index 2)
    engine.onAction({ id: 'player1', name: 'Alice' }, { type: 'PLAY_CARD', data: { cardIndex: 2 } });
    assert.strictEqual(engine.state.currentPlayerIndex, 1, 'Turn should advance to player2');
    
    // 2. Try playing out of turn (player3 plays Blue 8)
    engine.onAction({ id: 'player3', name: 'Charlie' }, { type: 'PLAY_CARD', data: { cardIndex: 0 } });
    assert.strictEqual(engine.state.currentPlayerIndex, 1, 'Out of turn play should be ignored');
    
    // 3. Let player2 play Red 3
    engine.onAction({ id: 'player2', name: 'Bob' }, { type: 'PLAY_CARD', data: { cardIndex: 0 } });
    assert.strictEqual(engine.state.currentPlayerIndex, 2, 'Turn should advance to player3');
    
    // 4. Player3 draws a card instead of playing
    engine.onAction({ id: 'player3', name: 'Charlie' }, { type: 'DRAW_CARD', data: {} });
    assert.strictEqual(engine.state.currentPlayerIndex, 0, 'Turn should advance to player1 after drawing');
    
    // 5. Player1 plays Reverse (set currentColor to Blue first so Reverse matches)
    engine.state.currentColor = 'Blue';
    engine.onAction({ id: 'player1', name: 'Alice' }, { type: 'PLAY_CARD', data: { cardIndex: 1 } }); // Blue Reverse (index 1)
    assert.strictEqual(engine.state.direction, -1, 'Direction should reverse');
    assert.strictEqual(engine.state.currentPlayerIndex, 2, 'Turn should go backwards to player3');
});

test('UNO - Draw Penalty Stacking', () => {
    const engine = loadEngine('assets/engines/uno.js');
    const players = [
        { id: 'player1', name: 'Alice' },
        { id: 'player2', name: 'Bob' },
        { id: 'player3', name: 'Charlie' }
    ];
    engine.onInit({ startingHandSize: 5, stacking: true }, players);
    
    // Give all players enough cards so they don't end the round on playing DrawTwo
    engine.state.hands['player1'] = [{ color: 'Red', value: 'DrawTwo' }, { color: 'Red', value: '9' }, { color: 'Red', value: '8' }];
    engine.state.hands['player2'] = [{ color: 'Blue', value: 'DrawTwo' }, { color: 'Blue', value: '9' }, { color: 'Blue', value: '8' }];
    engine.state.hands['player3'] = [{ color: 'Red', value: '5' }, { color: 'Red', value: '6' }];
    engine.state.discardPile = [{ color: 'Red', value: '3' }];
    engine.state.currentColor = 'Red';
    engine.state.currentValue = '3';
    engine.state.currentPlayerIndex = 0; // player1
    engine.state.direction = 1;
    
    // Player 1 plays DrawTwo
    engine.onAction({ id: 'player1', name: 'Alice' }, { type: 'PLAY_CARD', data: { cardIndex: 0 } });
    assert.strictEqual(engine.state.drawPending, 2, 'Draw pending should be 2');
    assert.strictEqual(engine.state.currentPlayerIndex, 1, 'Turn should advance to player 2');
    
    // Player 2 stacks another DrawTwo
    engine.onAction({ id: 'player2', name: 'Bob' }, { type: 'PLAY_CARD', data: { cardIndex: 0 } });
    assert.strictEqual(engine.state.drawPending, 4, 'Draw pending should accumulate to 4');
    assert.strictEqual(engine.state.currentPlayerIndex, 2, 'Turn should advance to player 3');
    
    // Player 3 has no DrawTwo, must draw cards. Record hand size before drawing.
    const sizeBefore = engine.state.hands['player3'].length;
    engine.onAction({ id: 'player3', name: 'Charlie' }, { type: 'DRAW_CARD', data: {} });
    
    assert.strictEqual(engine.state.hands['player3'].length, sizeBefore + 4, 'Player 3 should have drawn 4 cards');
    assert.strictEqual(engine.state.drawPending, 0, 'Draw pending should reset to 0');
    assert.strictEqual(engine.state.currentPlayerIndex, 0, 'Turn advances to player 1');
});

test('UNO - Stacking Disabled Rule', () => {
    const engine = loadEngine('assets/engines/uno.js');
    const players = [
        { id: 'player1', name: 'Alice' },
        { id: 'player2', name: 'Bob' }
    ];
    engine.onInit({ startingHandSize: 5, stacking: false }, players);
    
    engine.state.hands['player1'] = [{ color: 'Red', value: 'DrawTwo' }, { color: 'Red', value: '9' }];
    engine.state.hands['player2'] = [{ color: 'Blue', value: 'DrawTwo' }, { color: 'Blue', value: '9' }];
    engine.state.discardPile = [{ color: 'Red', value: '3' }];
    engine.state.currentColor = 'Red';
    engine.state.currentValue = '3';
    engine.state.currentPlayerIndex = 0; // player1
    engine.state.direction = 1;
    
    // Player 1 plays DrawTwo. With stacking = false, the penalty is applied instantly to the next player, and the turn skips them.
    engine.onAction({ id: 'player1', name: 'Alice' }, { type: 'PLAY_CARD', data: { cardIndex: 0 } });
    
    assert.strictEqual(engine.state.drawPending, 0, 'Draw pending should be 0 because penalty is applied immediately');
    assert.strictEqual(engine.state.hands['player2'].length, 4, 'Player 2 should have drawn 2 penalty cards immediately (2 -> 4)');
    // Since player 2 was skipped, currentPlayerIndex should wrap around back to player 1
    assert.strictEqual(engine.state.currentPlayerIndex, 0, 'Turn should skip player 2 and advance to player 1');
});

test('UNO - Seven-Zero Swap Rules', () => {
    const engine = loadEngine('assets/engines/uno.js');
    const players = [
        { id: 'player1', name: 'Alice' },
        { id: 'player2', name: 'Bob' },
        { id: 'player3', name: 'Charlie' }
    ];
    engine.onInit({ startingHandSize: 5, sevenZero: true }, players);
    
    engine.state.hands['player1'] = [{ color: 'Red', value: '7' }, { color: 'Blue', value: '0' }, { color: 'Red', value: '9' }];
    engine.state.hands['player2'] = [{ color: 'Green', value: '1' }, { color: 'Green', value: '2' }, { color: 'Green', value: '3' }];
    engine.state.hands['player3'] = [{ color: 'Yellow', value: '8' }, { color: 'Yellow', value: '7' }];
    engine.state.discardPile = [{ color: 'Red', value: '3' }];
    engine.state.currentColor = 'Red';
    engine.state.currentValue = '3';
    engine.state.currentPlayerIndex = 0;
    engine.state.direction = 1;
    
    // Play 7 and swap with player 3
    engine.onAction({ id: 'player1', name: 'Alice' }, { type: 'PLAY_CARD', data: { cardIndex: 0, swapPlayerId: 'player3' } });
    
    // Alice's hand should now be Charlie's previous hand (Yellow 8, Yellow 7) + her remaining cards (Blue 0, Red 9)
    // Wait, Alice played '7', remaining hand was [Blue 0, Red 9]. She swapped with Charlie [Yellow 8, Yellow 7].
    // So Alice's hand should now be [Yellow 8, Yellow 7]. Charlie's hand should be [Blue 0, Red 9].
    assert.strictEqual(engine.state.hands['player1'].length, 2);
    assert.strictEqual(engine.state.hands['player3'].length, 2);
    
    // Next turn is Bob (player2)
    assert.strictEqual(engine.state.currentPlayerIndex, 1);
    
    // Manually pass turn back to Alice (player1)
    engine.state.currentPlayerIndex = 0;
    
    // Set up Alice's hand and top card so play of '0' works and doesn't end the round
    engine.state.hands['player1'] = [{ color: 'Blue', value: '0' }, { color: 'Red', value: '9' }]; // P1 hand: [Blue 0, Red 9]
    engine.state.hands['player2'] = [{ color: 'Green', value: '1' }]; // P2 hand: [Green 1]
    engine.state.hands['player3'] = [{ color: 'Yellow', value: '8' }]; // P3 hand: [Yellow 8]
    engine.state.currentColor = 'Blue';
    engine.state.currentValue = '0';
    
    engine.onAction({ id: 'player1', name: 'Alice' }, { type: 'PLAY_CARD', data: { cardIndex: 0 } }); // plays Blue 0
    
    // Direction = 1, so P1's remaining hand [Red 9] goes to P2. P2's hand [Green 1] goes to P3. P3's hand [Yellow 8] goes to P1.
    assert.strictEqual(engine.state.hands['player2'][0].value, '9', 'Bob should get Alice\'s remaining card');
    assert.strictEqual(engine.state.hands['player3'][0].value, '1', 'Charlie should get Bob\'s card');
    assert.strictEqual(engine.state.hands['player1'][0].value, '8', 'Alice should get Charlie\'s card');
});

test('UNO - Jump-In Rule', () => {
    const engine = loadEngine('assets/engines/uno.js');
    const players = [
        { id: 'player1', name: 'Alice' },
        { id: 'player2', name: 'Bob' },
        { id: 'player3', name: 'Charlie' }
    ];
    engine.onInit({ startingHandSize: 5, jumpIn: true }, players);
    
    // Give all players enough cards so they don't win
    engine.state.hands['player1'] = [{ color: 'Red', value: '5' }, { color: 'Red', value: '6' }];
    engine.state.hands['player2'] = [{ color: 'Green', value: '8' }, { color: 'Green', value: '9' }];
    engine.state.hands['player3'] = [{ color: 'Green', value: '8' }, { color: 'Green', value: '7' }];
    
    engine.state.discardPile = [{ color: 'Red', value: '2' }];
    engine.state.currentColor = 'Red';
    engine.state.currentValue = '2';
    engine.state.currentPlayerIndex = 0; // Alice's turn
    engine.state.direction = 1;
    
    // Alice plays Red 5 (now top card is Red 5)
    engine.onAction({ id: 'player1', name: 'Alice' }, { type: 'PLAY_CARD', data: { cardIndex: 0 } });
    assert.strictEqual(engine.state.currentPlayerIndex, 1, 'Next turn should be Bob');
    
    // Let's set top card to Green 8
    engine.state.discardPile.push({ color: 'Green', value: '8' });
    engine.state.currentColor = 'Green';
    engine.state.currentValue = '8';
    
    // Charlie (player3) has Green 8! He jumps in out of turn.
    engine.onAction({ id: 'player3', name: 'Charlie' }, { type: 'PLAY_CARD', data: { cardIndex: 0 } });
    
    assert.strictEqual(engine.state.currentPlayerIndex, 0, 'Turn should advance from Charlie (idx 2) to Alice (idx 0)');
    assert.strictEqual(engine.state.hands['player3'].length, 1, 'Charlie should have played his card and have 1 card remaining');
});

test('UNO - UNO Declarations & Catch Penalty', () => {
    const engine = loadEngine('assets/engines/uno.js');
    const players = [
        { id: 'player1', name: 'Alice' },
        { id: 'player2', name: 'Bob' }
    ];
    engine.onInit({ startingHandSize: 2 }, players);
    
    engine.state.hands['player1'] = [{ color: 'Red', value: '5' }, { color: 'Blue', value: '9' }];
    engine.state.hands['player2'] = [{ color: 'Green', value: '2' }, { color: 'Yellow', value: '4' }];
    engine.state.discardPile = [{ color: 'Red', value: '3' }];
    engine.state.currentColor = 'Red';
    engine.state.currentValue = '3';
    engine.state.currentPlayerIndex = 0;
    
    // Alice plays Red 5, leaving 1 card (Blue 9). She does NOT call UNO first.
    engine.onAction({ id: 'player1', name: 'Alice' }, { type: 'PLAY_CARD', data: { cardIndex: 0 } });
    
    assert.strictEqual(engine.state.hands['player1'].length, 1);
    assert.strictEqual(engine.state.unoDeclared['player1'], false, 'Should be flagged as not declared');
    
    // Bob catches Alice
    engine.onAction({ id: 'player2', name: 'Bob' }, { type: 'CATCH_UNO', data: { targetId: 'player1' } });
    
    assert.strictEqual(engine.state.hands['player1'].length, 3, 'Alice should be penalized with 2 cards');
    assert.strictEqual(engine.state.unoDeclared['player1'], true, 'Status updated after penalty');
});

test('UNO - Reconnect & State Synchronization', () => {
    const engine = loadEngine('assets/engines/uno.js');
    const players = [
        { id: 'player1', name: 'Alice' },
        { id: 'player2', name: 'Bob' }
    ];
    engine.onInit({ startingHandSize: 3 }, players);
    
    engine.state.currentPlayerIndex = 1;
    const originalHand = JSON.parse(JSON.stringify(engine.state.hands['player1']));
    const originalScores = JSON.parse(JSON.stringify(engine.state.scores));
    
    // Simulate Player 1 Disconnect & Reconnect
    engine.onPlayerLeave({ id: 'player1', name: 'Alice' });
    
    // Player list in active engine should still retain player data but sync is called when they join back
    engine.onPlayerJoin({ id: 'player1', name: 'Alice' });
    
    assert.deepStrictEqual(JSON.parse(JSON.stringify(engine.state.hands['player1'])), originalHand, 'Hand should be preserved on reconnect');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(engine.state.scores)), originalScores, 'Scores should be preserved on reconnect');
});

test('UNO - State Validation Repair', () => {
    const engine = loadEngine('assets/engines/uno.js');
    const players = [
        { id: 'player1', name: 'Alice' },
        { id: 'player2', name: 'Bob' }
    ];
    engine.onInit({ startingHandSize: 3 }, players);
    
    // Corrupt state purposefully
    engine.state.currentPlayerIndex = 5; // out of bounds
    engine.state.timerRemaining = -10;
    engine.state.scores['player1'] = NaN;
    engine.state.hands['player1'].push(null); // invalid card
    
    const valid = engine.validateState();
    
    assert.strictEqual(valid, false, 'State should be reported as invalid before repair');
    assert.strictEqual(engine.state.currentPlayerIndex, 0, 'Current player index should be reset to 0');
    assert.strictEqual(engine.state.timerRemaining, 0, 'Timer should be reset to 0');
    assert.strictEqual(engine.state.scores['player1'], 0, 'NaN score should be reset to 0');
    assert.ok(!engine.state.hands['player1'].includes(null), 'Null card should be removed from hand');
});

test('Project Coop - Procedural Level solvability', () => {
    const engine = loadEngine('assets/engines/project-coop.js');
    const players = [
        { id: 'player1', name: 'Alice' },
        { id: 'player2', name: 'Bob' }
    ];
    engine.onInit({ levelType: 'procedural', difficulty: 'medium' }, players);
    
    assert.strictEqual(engine.state.status, 'play');
    assert.ok(engine.state.entities.length > 0);
    
    // Check key and door exist
    const hasKey = engine.state.entities.some(e => e.type === 'key');
    const hasDoor = engine.state.entities.some(e => e.type === 'door');
    assert.ok(hasKey, 'Level must contain a key');
    assert.ok(hasDoor, 'Level must contain an exit door');
});

test('Project Coop - Physics & Collision', () => {
    const engine = loadEngine('assets/engines/project-coop.js');
    const players = [
        { id: 'player1', name: 'Alice' }
    ];
    engine.onInit({ levelType: 'handcrafted' }, players);
    
    const p = engine.state.players['player1'];
    // Position player in the air
    p.x = 100;
    p.y = 100;
    p.vy = 0;
    p.vx = 0;
    p.grounded = false;
    
    // Run tick to let gravity pull player down
    engine.onTick(0.016);
    assert.ok(p.y > 100, 'Player should fall under gravity');
    
    // Move player close to platform floor (y = 550, platform height starts at 550, player height is 32)
    // So player y should sit on 550 - 32 = 518
    p.x = 100;
    p.y = 510;
    p.vy = 5;
    
    // Run multiple ticks until player is grounded
    for (let i = 0; i < 15; i++) {
        engine.onTick(0.016);
    }
    
    assert.strictEqual(p.y, 518, 'Player should land on the floor');
    assert.ok(p.grounded, 'Player should be grounded');
});

test('Project Coop - Moving Platform riding logic', () => {
    const engine = loadEngine('assets/engines/project-coop.js');
    const players = [
        { id: 'player1', name: 'Alice' }
    ];
    // Load procedural gap segment with moving platform
    engine.onInit({ levelType: 'procedural' }, players);
    
    // Find moving platform
    const mp = engine.state.entities.find(e => e.isMoving);
    if (!mp) return; // skip if segment type was not gap_mp
    
    const p = engine.state.players['player1'];
    // Position player directly on top of the moving platform
    p.x = mp.x + 10;
    p.y = mp.y - 32;
    p.vx = 0;
    p.vy = 0;
    p.grounded = true;
    
    const startX = p.x;
    
    // Tick engine to move platform
    engine.onTick(0.016);
    
    assert.notStrictEqual(p.x, startX, 'Player should be carried horizontally by moving platform');
});

test('Project Coop - Block Pushing & Switch Activation', () => {
    const engine = loadEngine('assets/engines/project-coop.js');
    const players = [
        { id: 'player1', name: 'Alice' }
    ];
    engine.onInit({ levelType: 'handcrafted' }, players);
    
    // Handcrafted Level 1 has a block with mass 1 and key1/door1
    const block = engine.state.entities.find(e => e.type === 'block');
    assert.ok(block, 'Level 1 must contain a push block');
    
    const p = engine.state.players['player1'];
    
    // Position player standing on the floor (y = 518) right next to block on the left
    p.x = block.x - 31;
    p.y = 518;
    p.vx = 5; // moving right
    
    const startX = block.x;
    
    // Send action INPUT moving right
    engine.onAction({ id: 'player1' }, { type: 'INPUT', data: { right: true } });
    engine.onTick(0.016);
    
    assert.ok(block.x > startX, 'Player should push the block');
});

test('UNO - Triple WildDrawFour Stacking', () => {
    const engine = loadEngine('assets/engines/uno.js');
    const players = [
        { id: 'player1', name: 'Alice' },
        { id: 'player2', name: 'Bob' },
        { id: 'player3', name: 'Charlie' }
    ];
    engine.onInit({ startingHandSize: 5, stacking: true }, players);
    
    engine.state.hands['player1'] = [{ color: 'Wild', value: 'WildDrawFour' }, { color: 'Red', value: '9' }, { color: 'Red', value: '8' }];
    engine.state.hands['player2'] = [{ color: 'Wild', value: 'WildDrawFour' }, { color: 'Blue', value: '9' }, { color: 'Blue', value: '8' }];
    engine.state.hands['player3'] = [{ color: 'Wild', value: 'WildDrawFour' }, { color: 'Green', value: '9' }, { color: 'Green', value: '8' }];
    engine.state.discardPile = [{ color: 'Red', value: '3' }];
    engine.state.currentColor = 'Red';
    engine.state.currentValue = '3';
    engine.state.currentPlayerIndex = 0; // player1
    engine.state.direction = 1;

    // Player 1 plays WildDrawFour
    engine.onAction({ id: 'player1', name: 'Alice' }, { type: 'PLAY_CARD', data: { cardIndex: 0, chosenColor: 'Red' } });
    
    // Player 2 plays WildDrawFour
    engine.onAction({ id: 'player2', name: 'Bob' }, { type: 'PLAY_CARD', data: { cardIndex: 0, chosenColor: 'Red' } });

    // Player 3 plays WildDrawFour
    engine.onAction({ id: 'player3', name: 'Charlie' }, { type: 'PLAY_CARD', data: { cardIndex: 0, chosenColor: 'Red' } });

    // Player 1 draws cards
    engine.onAction({ id: 'player1', name: 'Alice' }, { type: 'DRAW_CARD', data: {} });
    
    console.log("TEST OUTPUT - Player 1 hand size:", engine.state.hands['player1'].length);
    console.log("TEST OUTPUT - Player 3 hand size:", engine.state.hands['player3'].length);
    console.log("TEST OUTPUT - drawPending:", engine.state.drawPending);
});

test('UNO - 2-Player Triple WildDrawFour Stacking', () => {
    const engine = loadEngine('assets/engines/uno.js');
    const players = [
        { id: 'player1', name: 'Alice' },
        { id: 'player2', name: 'Bob' }
    ];
    engine.onInit({ startingHandSize: 5, stacking: true }, players);
    
    engine.state.hands['player1'] = [{ color: 'Wild', value: 'WildDrawFour' }, { color: 'Wild', value: 'WildDrawFour' }, { color: 'Red', value: '9' }];
    engine.state.hands['player2'] = [{ color: 'Wild', value: 'WildDrawFour' }, { color: 'Blue', value: '9' }];
    engine.state.discardPile = [{ color: 'Red', value: '3' }];
    engine.state.currentColor = 'Red';
    engine.state.currentValue = '3';
    engine.state.currentPlayerIndex = 0; // player1
    engine.state.direction = 1;

    // Alice plays WildDrawFour
    engine.onAction({ id: 'player1', name: 'Alice' }, { type: 'PLAY_CARD', data: { cardIndex: 0, chosenColor: 'Red' } });
    
    // Bob plays WildDrawFour
    engine.onAction({ id: 'player2', name: 'Bob' }, { type: 'PLAY_CARD', data: { cardIndex: 0, chosenColor: 'Red' } });

    // Alice plays WildDrawFour
    engine.onAction({ id: 'player1', name: 'Alice' }, { type: 'PLAY_CARD', data: { cardIndex: 0, chosenColor: 'Red' } });

    // Bob draws cards
    engine.onAction({ id: 'player2', name: 'Bob' }, { type: 'DRAW_CARD', data: {} });
    
    console.log("2-PLAYER TEST - Alice hand size:", engine.state.hands['player1'].length);
    console.log("2-PLAYER TEST - Bob hand size:", engine.state.hands['player2'].length);
    console.log("2-PLAYER TEST - drawPending:", engine.state.drawPending);
});

test('UNO - Triple WildDrawFour Stacking with Finisher', () => {
    const engine = loadEngine('assets/engines/uno.js');
    const players = [
        { id: 'player1', name: 'Alice' },
        { id: 'player2', name: 'Bob' },
        { id: 'player3', name: 'Charlie' }
    ];
    engine.onInit({ startingHandSize: 5, stacking: true }, players);
    
    engine.state.hands['player1'] = [{ color: 'Wild', value: 'WildDrawFour' }, { color: 'Red', value: '9' }];
    engine.state.hands['player2'] = [{ color: 'Wild', value: 'WildDrawFour' }, { color: 'Blue', value: '9' }];
    engine.state.hands['player3'] = [{ color: 'Wild', value: 'WildDrawFour' }]; // Charlie has ONLY this card
    engine.state.discardPile = [{ color: 'Red', value: '3' }];
    engine.state.currentColor = 'Red';
    engine.state.currentValue = '3';
    engine.state.currentPlayerIndex = 0; // Alice
    engine.state.direction = 1;

    // Alice plays WildDrawFour
    engine.onAction({ id: 'player1', name: 'Alice' }, { type: 'PLAY_CARD', data: { cardIndex: 0, chosenColor: 'Red' } });
    
    // Bob plays WildDrawFour
    engine.onAction({ id: 'player2', name: 'Bob' }, { type: 'PLAY_CARD', data: { cardIndex: 0, chosenColor: 'Red' } });

    // Charlie plays WildDrawFour (his last card!)
    engine.onAction({ id: 'player3', name: 'Charlie' }, { type: 'PLAY_CARD', data: { cardIndex: 0, chosenColor: 'Red' } });

    // Who is the current player now?
    console.log("FINISHER TEST - Current Player after Charlie finished:", engine.state.playerIds[engine.state.currentPlayerIndex]);
    console.log("FINISHER TEST - Finished Players:", JSON.stringify(engine.state.finishedPlayers));
    console.log("FINISHER TEST - drawPending:", engine.state.drawPending);

    // Alice draws cards (since she is next)
    engine.onAction({ id: 'player1', name: 'Alice' }, { type: 'DRAW_CARD', data: {} });
    
    console.log("FINISHER TEST - Alice hand size:", engine.state.hands['player1'].length);
    console.log("FINISHER TEST - Bob hand size:", engine.state.hands['player2'].length);
    console.log("FINISHER TEST - Charlie hand size:", engine.state.hands['player3'] ? engine.state.hands['player3'].length : 'undefined/deleted');
});

test('UNO - Stacking Combinations Disallowed (+2 on +4 and +4 on +2)', () => {
    const engine = loadEngine('assets/engines/uno.js');
    const players = [
        { id: 'player1', name: 'Alice' },
        { id: 'player2', name: 'Bob' },
        { id: 'player3', name: 'Charlie' }
    ];
    engine.onInit({ startingHandSize: 5, stacking: true }, players);
    
    // Set up hands with different color/value combinations
    engine.state.hands['player1'] = [{ color: 'Wild', value: 'WildDrawFour' }, { color: 'Red', value: '9' }];
    engine.state.hands['player2'] = [{ color: 'Blue', value: 'DrawTwo' }, { color: 'Blue', value: '9' }]; // different color, DrawTwo
    engine.state.hands['player3'] = [{ color: 'Wild', value: 'WildDrawFour' }, { color: 'Green', value: '9' }];
    engine.state.discardPile = [{ color: 'Red', value: '3' }];
    engine.state.currentColor = 'Red';
    engine.state.currentValue = '3';
    engine.state.currentPlayerIndex = 0; // Alice
    engine.state.direction = 1;

    // 1. Alice plays +4 (currentColor becomes Yellow)
    engine.onAction({ id: 'player1', name: 'Alice' }, { type: 'PLAY_CARD', data: { cardIndex: 0, chosenColor: 'Yellow' } });
    assert.strictEqual(engine.state.drawPending, 4);
    assert.strictEqual(engine.state.currentPlayerIndex, 1); // Bob's turn

    // 2. Bob tries to stack Blue DrawTwo on WildDrawFour - SHOULD BE DISALLOWED
    engine.onAction({ id: 'player2', name: 'Bob' }, { type: 'PLAY_CARD', data: { cardIndex: 0 } });
    assert.strictEqual(engine.state.drawPending, 4, 'drawPending should remain 4 since stack was disallowed');
    assert.strictEqual(engine.state.currentPlayerIndex, 1, 'Turn should remain Bob\'s turn');

    // 3. Bob draws cards (drawPending is 4)
    engine.onAction({ id: 'player2', name: 'Bob' }, { type: 'DRAW_CARD', data: {} });
    assert.strictEqual(engine.state.drawPending, 0);
    assert.strictEqual(engine.state.currentPlayerIndex, 2); // Charlie's turn

    // 4. Charlie plays +4
    engine.onAction({ id: 'player3', name: 'Charlie' }, { type: 'PLAY_CARD', data: { cardIndex: 0, chosenColor: 'Red' } });
    assert.strictEqual(engine.state.drawPending, 4);
    assert.strictEqual(engine.state.currentPlayerIndex, 0); // Alice's turn

    // 5. Alice tries to stack +2 (we give Alice a +2 to check if she can stack it on +4)
    engine.state.hands['player1'].push({ color: 'Red', value: 'DrawTwo' });
    const p1DrawTwoIdx = engine.state.hands['player1'].length - 1;
    // Alice tries to stack DrawTwo on WildDrawFour - SHOULD BE DISALLOWED
    engine.onAction({ id: 'player1', name: 'Alice' }, { type: 'PLAY_CARD', data: { cardIndex: p1DrawTwoIdx } });
    assert.strictEqual(engine.state.drawPending, 4, 'drawPending should remain 4');
    assert.strictEqual(engine.state.currentPlayerIndex, 0, 'Turn should remain Alice\'s turn');

    // 6. Alice draws penalty (drawPending is 4)
    const handSizeBefore = engine.state.hands['player1'].length;
    engine.onAction({ id: 'player1', name: 'Alice' }, { type: 'DRAW_CARD', data: {} });
    assert.strictEqual(engine.state.hands['player1'].length, handSizeBefore + 4);
    assert.strictEqual(engine.state.drawPending, 0);
});

test('UNO - Turn Timer Timeout Stacking Penalty', () => {
    const engine = loadEngine('assets/engines/uno.js');
    const players = [
        { id: 'player1', name: 'Alice' },
        { id: 'player2', name: 'Bob' }
    ];
    // Initialize with turn timer active
    engine.onInit({ startingHandSize: 5, stacking: true, turnTimer: 10 }, players);

    engine.state.hands['player1'] = [{ color: 'Wild', value: 'WildDrawFour' }, { color: 'Red', value: '9' }];
    engine.state.hands['player2'] = [{ color: 'Blue', value: '9' }];
    engine.state.discardPile = [{ color: 'Red', value: '3' }];
    engine.state.currentColor = 'Red';
    engine.state.currentValue = '3';
    engine.state.currentPlayerIndex = 0; // Alice
    engine.state.direction = 1;

    // Alice plays +4
    engine.onAction({ id: 'player1', name: 'Alice' }, { type: 'PLAY_CARD', data: { cardIndex: 0, chosenColor: 'Blue' } });
    assert.strictEqual(engine.state.drawPending, 4);
    assert.strictEqual(engine.state.currentPlayerIndex, 1); // Bob's turn

    // Simulate turn timer expiring for Bob (drawPending is 4)
    const bobHandSizeBefore = engine.state.hands['player2'].length;
    engine.state.timerRemaining = 0;
    engine.onTick(0); // Trigger timer check

    // Bob should draw the 4 penalty cards, NOT 1 card
    assert.strictEqual(engine.state.hands['player2'].length, bobHandSizeBefore + 4);
    assert.strictEqual(engine.state.drawPending, 0);
    assert.strictEqual(engine.state.currentPlayerIndex, 0); // Turn advanced back to Alice
});

test('Project Coop - Procedural Level scaling for 2, 4, 6, 8 players', () => {
    const engine = loadEngine('assets/engines/project-coop.js');
    const pCounts = [2, 4, 6, 8];
    for (let count of pCounts) {
        const players = [];
        for (let i = 0; i < count; i++) {
            players.push({ id: 'player' + (i+1), name: 'Player' + (i+1) });
        }
        engine.onInit({ levelType: 'procedural', difficulty: 'medium' }, players);
        assert.strictEqual(engine.state.status, 'play');
        assert.ok(engine.state.entities.length > 0, `Entities should be generated for ${count} players`);
        const door = engine.state.entities.find(e => e.id === 'door1');
        const keys = engine.state.entities.filter(e => e.type === 'key');
        assert.ok(door, `Door should exist for ${count} players`);
        assert.ok(keys.length > 0, `At least one key should exist for ${count} players`);
        
        // Assert solvability
        const verified = engine.verifyLevel(engine.state.entities, count);
        assert.ok(verified, `Generated level should be verified/solvable for ${count} players`);
    }
});

test('Project Coop - AND-gate switches verification', () => {
    const engine = loadEngine('assets/engines/project-coop.js');
    const players = [
        { id: 'player1', name: 'Alice' },
        { id: 'player2', name: 'Bob' }
    ];
    engine.onInit({ levelType: 'handcrafted' }, players);
    
    // Set custom entities with an AND gate
    engine.state.entities = [
        { id: 'test_gate', type: 'door', x: 300, y: 450, w: 40, h: 100, locked: true },
        { id: 'sw1', type: 'switch', x: 100, y: 535, w: 32, h: 15, pressed: false, targetId: 'test_gate' },
        { id: 'sw2', type: 'switch', x: 200, y: 535, w: 32, h: 15, pressed: false, targetId: 'test_gate' }
    ];
    
    const p1 = engine.state.players['player1'];
    const p2 = engine.state.players['player2'];
    
    // Initially, no one is on switches
    p1.x = 0; p1.y = 0;
    p2.x = 0; p2.y = 0;
    engine.updateSwitches(0.016);
    
    const gate = engine.state.entities.find(e => e.id === 'test_gate');
    assert.strictEqual(gate.locked, true, 'Gate should be locked initially');
    
    // Stand on sw1 only
    p1.x = 100; p1.y = 518;
    engine.updateSwitches(0.016);
    assert.strictEqual(gate.locked, true, 'Gate should be locked when only one switch is pressed');
    
    // Stand on both sw1 and sw2
    p2.x = 200; p2.y = 518;
    engine.updateSwitches(0.016);
    assert.strictEqual(gate.locked, false, 'Gate should unlock when both switches are pressed');
    
    // Step off sw1
    p1.x = 0; p1.y = 0;
    engine.updateSwitches(0.016);
    assert.strictEqual(gate.locked, true, 'Gate should lock again when one switch is released');
});

test('Project Coop - Timed switches verification', () => {
    const engine = loadEngine('assets/engines/project-coop.js');
    const players = [
        { id: 'player1', name: 'Alice' }
    ];
    engine.onInit({ levelType: 'handcrafted' }, players);
    
    engine.state.entities = [
        { id: 'test_gate', type: 'door', x: 300, y: 450, w: 40, h: 100, locked: true },
        { id: 'sw1', type: 'switch', x: 100, y: 535, w: 32, h: 15, pressed: false, targetId: 'test_gate', isTimed: true, duration: 2.0 }
    ];
    
    const p1 = engine.state.players['player1'];
    const gate = engine.state.entities.find(e => e.id === 'test_gate');
    const sw1 = engine.state.entities.find(e => e.id === 'sw1');
    
    // Player stands on timed switch
    p1.x = 100; p1.y = 518;
    engine.updateSwitches(0.016);
    assert.strictEqual(sw1.pressed, true);
    assert.strictEqual(gate.locked, false);
    
    // Player steps off timed switch
    p1.x = 0; p1.y = 0;
    
    // Tick by 0.5s
    engine.updateSwitches(0.5);
    assert.strictEqual(sw1.pressed, true, 'Switch should remain active during timer');
    assert.strictEqual(gate.locked, false, 'Gate should remain unlocked during timer');
    
    // Tick by another 1.6s (total 2.1s, exceeding the 2.0s duration)
    engine.updateSwitches(1.6);
    assert.strictEqual(sw1.pressed, false, 'Switch should deactivate after timer expires');
    assert.strictEqual(gate.locked, true, 'Gate should lock again after timer expires');
});





