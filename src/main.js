import Phaser from 'phaser';

// ゲームの状態管理
const gameState = {
  influence: 0,
  karma: 0, // 正なら平和的、負なら暴力的
  isMenuOpen: false
};

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // 画像がないので、プログラムでテクスチャ(色付き四角)を作る
    // 本番ではここで画像をロードします
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    
    // 加藤先生（青）
    graphics.fillStyle(0x3498db, 1.0);
    graphics.fillRect(0, 0, 32, 32);
    graphics.generateTexture('player', 32, 32);

    // 区民（赤）
    graphics.clear();
    graphics.fillStyle(0xe74c3c, 1.0);
    graphics.fillRect(0, 0, 32, 32);
    graphics.generateTexture('npc', 32, 32);

    // 地面（緑）
    graphics.clear();
    graphics.fillStyle(0x27ae60, 1.0);
    graphics.fillRect(0, 0, 32, 32);
    graphics.generateTexture('ground', 32, 32);
  }

  create() {
    // 1. マップ作成（簡易的に地面を敷き詰める）
    // 品川区をイメージして広めに作る
    this.physics.world.setBounds(0, 0, 1600, 1600);
    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 50; y++) {
        this.add.image(x * 32, y * 32, 'ground').setOrigin(0);
      }
    }

    // 2. プレイヤー（加藤先生）作成
    // 画面中央付近に配置
    this.player = this.physics.add.sprite(800, 800, 'player');
    this.player.setCollideWorldBounds(true);
    
    // カメラ設定（プレイヤーを追従）
    this.cameras.main.setBounds(0, 0, 1600, 1600);
    this.cameras.main.startFollow(this.player, true, 0.05, 0.05);
    this.cameras.main.setZoom(1.5);

    // 3. NPC（区民）グループ作成
    this.npcs = this.physics.add.group();
    
    // とりあえず5人の区民をランダム配置
    for(let i=0; i<5; i++) {
      const x = Phaser.Math.Between(100, 1500);
      const y = Phaser.Math.Between(100, 1500);
      const npc = this.npcs.create(x, y, 'npc');
      npc.setImmovable(true); // ぶつかっても動かない
      npc.name = `品川区民 ${i+1}`; // 名前をつける
    }

    // 4. 当たり判定とインタラクション
    this.physics.add.collider(this.player, this.npcs, this.handleNpcCollision, null, this);

    // 5. 操作キー設定
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });

    // モバイル操作用変数の初期化
    this.mobileInput = { up: false, down: false, left: false, right: false };
    this.setupMobileControls();

    // 最初のメッセージ
    this.showMessage("加藤: 「...退屈だ。この品川を変えてやる。」");
  }

  update() {
    // メニューが開いているときは動けない
    if (gameState.isMenuOpen) {
      this.player.setVelocity(0);
      return;
    }

    const speed = 200;
    this.player.setVelocity(0);

    // PC操作 (矢印 または WASD)
    // モバイル操作 (タッチボタン)
    if (this.cursors.left.isDown || this.wasd.left.isDown || this.mobileInput.left) {
      this.player.setVelocityX(-speed);
    } else if (this.cursors.right.isDown || this.wasd.right.isDown || this.mobileInput.right) {
      this.player.setVelocityX(speed);
    }

    if (this.cursors.up.isDown || this.wasd.up.isDown || this.mobileInput.up) {
      this.player.setVelocityY(-speed);
    } else if (this.cursors.down.isDown || this.wasd.down.isDown || this.mobileInput.down) {
      this.player.setVelocityY(speed);
    }
  }

  // NPCにぶつかった時の処理
  handleNpcCollision(player, npc) {
    // すでにメニューが開いていたら何もしない
    if (gameState.isMenuOpen) return;

    // 少し離れる（めり込み防止）
    if(player.body.touching.up) player.y += 5;
    if(player.body.touching.down) player.y -= 5;
    if(player.body.touching.left) player.x += 5;
    if(player.body.touching.right) player.x -= 5;

    // UIを表示
    this.openInteractionMenu(npc);
  }

  openInteractionMenu(npc) {
    gameState.isMenuOpen = true;
    gameState.currentTargetNpc = npc; // 現在ターゲットにしているNPCを保存

    const menu = document.getElementById('action-menu');
    document.getElementById('target-name').innerText = npc.name;
    menu.classList.remove('hidden');
  }

  showMessage(text) {
    const box = document.getElementById('message-box');
    const p = document.getElementById('message-text');
    p.innerText = text;
    box.classList.remove('hidden');
  }

  setupMobileControls() {
    // スマホのタッチイベントをバインド
    const bindBtn = (id, direction) => {
      const btn = document.getElementById(id);
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); this.mobileInput[direction] = true; });
      btn.addEventListener('touchend', (e) => { e.preventDefault(); this.mobileInput[direction] = false; });
      // PCでのテスト用クリック対応
      btn.addEventListener('mousedown', () => { this.mobileInput[direction] = true; });
      btn.addEventListener('mouseup', () => { this.mobileInput[direction] = false; });
    };

    bindBtn('dpad-up', 'up');
    bindBtn('dpad-down', 'down');
    bindBtn('dpad-left', 'left');
    bindBtn('dpad-right', 'right');
  }
}

// ゲーム設定
const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 }, // 見下ろし視点なので重力は0
      debug: false
    }
  },
  scene: GameScene
};

const game = new Phaser.Game(config);

// ウィンドウリサイズ対応
window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});

// グローバル関数としてUIから呼べるようにする
window.gameAction = (action) => {
  const npc = gameState.currentTargetNpc;
  let msg = "";

  if (action === 'talk') {
    msg = `${npc.name}: 「今日はいい天気ですね、先生。」\n(評判が少し上がった)`;
    gameState.influence += 1;
    gameState.karma += 5;
  } else if (action === 'bribe') {
    msg = `${npc.name}: 「おっと、これは...ありがたく頂きます。」\n(支配率が上がった)`;
    gameState.influence += 5;
    gameState.karma -= 2;
  } else if (action === 'punch') {
    msg = `加藤先生は${npc.name}を殴り飛ばした！\n${npc.name}: 「ひぃぃ！従います！」\n(支配率が大幅に上がったが、評判は地に落ちた)`;
    gameState.influence += 10;
    gameState.karma -= 20;
    
    // 殴られたNPCを消す演出（Phaserのオブジェクト操作）
    npc.setTint(0x000000); // 黒焦げにする
    // npc.destroy(); // 消すならこっち
  }

  // ステータス更新
  updateStatusUI();

  // メニューを閉じてメッセージを出す
  document.getElementById('action-menu').classList.add('hidden');
  
  // 少し遅らせてメッセージボックス表示（メニューと被らないよう）
  const scene = game.scene.scenes[0];
  scene.showMessage(msg);
};

window.closeMenu = () => {
  document.getElementById('action-menu').classList.add('hidden');
  gameState.isMenuOpen = false;
};

window.closeMessage = () => {
  document.getElementById('message-box').classList.add('hidden');
  gameState.isMenuOpen = false;
};

function updateStatusUI() {
  document.getElementById('influence').innerText = `品川支配率: ${gameState.influence}%`;
  
  let karmaText = "普通";
  if (gameState.karma > 10) karmaText = "聖人";
  if (gameState.karma < -10) karmaText = "危険人物";
  
  document.getElementById('karma').innerText = `評判: ${karmaText}`;
}