//constants 
let pointspanelWidth;
let pointspanelHeight;
let playpanelWidth; 
let playpanelHeight;
let playpanelHorizontalMargin;
let gameObject;
const playpanel = document.getElementById("playpanel");
const pointspanel = document.getElementById("pointspanel");
const playpanelContext = playpanel.getContext("2d");
const pointspanelContext = pointspanel.getContext("2d");
const windowHeight = window.innerHeight, windowWidth = window.innerWidth;
const ball = 50, roundRadius = 30;
const scoreFont = "Artifakt Element Black";
const gameFont = "Bahnschrift SemiBold SemiConden";
const timeOut = 200;
const startWithBlocks = 6;
const KeyPressAudio = "sound/points.mp3";
const GameOverAudio = "sound/gameover.mp3"
const CaptureAudio = "sound/turning.mp3";
const headColorString = "#000000"
const tailColorString = "#800000"
const borderColorString = "#FFFFFF";
const pointsColorString = "#FF0000";
const pointsNotCapturedColorString = "#FF0000";
const delta = new Map();
delta.set('L', [-ball, 0]);
delta.set('R', [ball, 0]);
delta.set('U', [0, -ball]);
delta.set('D', [0, ball]);

function displayWindowSizeError(){
    pointspanel.style.display = "none";
    playpanel.style.display = "none";
    document.getElementById("home").style.display = "none";
}

function validWindowSize(windowWidth, windowHeight, ball){
    if(windowHeight < 400 || windowWidth < 1000)return false;

    pointspanelWidth = windowWidth;
    pointspanelHeight = Math.max(50, windowHeight/11);

    playpanelWidth = windowWidth - windowWidth % ball;
    playpanelHeight = (windowHeight - pointspanelHeight) - (windowHeight - pointspanelHeight) % ball;
    playpanelHorizontalMargin = (windowWidth - playpanelWidth)/2;

    playpanel.width = playpanelWidth;
    playpanel.height = playpanelHeight;
    pointspanel.width = pointspanelWidth;
    pointspanel.height = pointspanelHeight;
    playpanel.style.marginLeft = playpanelHorizontalMargin + "px";
    playpanel.style.marginRight = playpanelHorizontalMargin + "px";
    if(gameObject !== undefined && gameObject !== null){
        gameObject.resetGame();
        gameObject.display();
    }
    return true;
}



function boxBlur(canvasImageData, blurRadius){
    let width = canvasImageData.width, height = canvasImageData.height;
    let imageData = canvasImageData.data;
    let canvasImagePrefixSum2D = [];
    let pos = (row, col, layer) => (row*width+col)*4+layer;
    for(let r = 0; r< height; r++)
        for(let c = 0; c< width; c++)
            for(let layer = 0; layer < 4; layer++){
                let val = imageData[pos(r, c, layer)];
                if(r > 0)val += canvasImagePrefixSum2D[pos(r-1, c, layer)];
                if(c > 0)val += canvasImagePrefixSum2D[pos(r, c-1, layer)];
                if(r > 0 && c > 0)val -= canvasImagePrefixSum2D[pos(r-1, c-1, layer)];
                canvasImagePrefixSum2D.push(val);
            }

    let blurredImageData = [];
    for(let r = 0; r< height; r++)
        for(let c = 0; c< width; c++){
            let minR = Math.max(r-blurRadius, 0)-1, minC = Math.max(c-blurRadius, 0)-1;
            let maxR = Math.min(r+blurRadius, height-1), maxC = Math.min(c+blurRadius, width-1);
            let size = (maxR-minR)*(maxC-minC);
            for(let layer = 0; layer < 4; layer++){
                let sum = canvasImagePrefixSum2D[pos(maxR, maxC, layer)];
                if(minR !== -1)sum -= canvasImagePrefixSum2D[pos(minR, maxC, layer)];
                if(minC !== -1)sum -= canvasImagePrefixSum2D[pos(maxR, minC, layer)];
                if(minR !== -1 && minC !== -1)sum += canvasImagePrefixSum2D[pos(minR, minC, layer)];
                blurredImageData.push(sum/size);
            }
        }
    return new ImageData(new Uint8ClampedArray(blurredImageData), width, height);
}
function blurImage(canvasImageData){
    return boxBlur(canvasImageData, 5);
}

CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x+r, y);
    this.arcTo(x+w, y,   x+w, y+h, r);
    this.arcTo(x+w, y+h, x,   y+h, r);
    this.arcTo(x,   y+h, x,   y,   r);
    this.arcTo(x,   y,   x+w, y,   r);
    this.closePath();
    return this;
}

function playSound(file){
    let audio = document.createElement('audio');
    audio.src = file;
    audio.play()
}

function fontString(fontName, bold, size){
    return (bold === true?"Bold ":"") + size+"px "+fontName;
}

class SquareBlock{
    constructor(midX, midY, color) {
        this.midX = midX;
        this.midY = midY;
        while (this.midX < 0)this.midX += playpanelWidth;
        while (this.midX >= playpanelWidth)this.midX -= playpanelWidth;
        while (this.midY < 0)this.midY += playpanelHeight;
        while (this.midY >= playpanelHeight)this.midY -= playpanelHeight;
        this.color = color;
    }
    setColor(color){this.color = color;}
    getColor(){return this.color;}
    getMidX(){return this.midX;}
    getMidY(){return this.midY;}
    samePosition(block){return this.getMidX() === block.getMidX() && this.getMidY() === block.getMidY();}
    deepCopy(){return new SquareBlock(this.midX, this.midY, this.color);}
}


class Game{
    static highScore = 0;
    static pointsGain = 100;
    static moveGain = {1: 0, 2: 5};
    static gameTimer = 10000;
    static gameTimerIncrement = timeOut;
    static HIGHSCORE_KEYS = {1: "FreeHighScore"};
    static STATUS = {"START": 1, "OVER": 2,"CHOICE": 3, "RUNNING": 4};
    static MODE = {"FREE": 1};
    constructor(playpanelContext, pointspanelContext) {
        this.playpanelContext = playpanelContext;
        this.pointspanelContext = pointspanelContext;
        this.status = null;
        this.mode = 0;
        this.snakeBody = [];
        this.points = null
        this.pointsTimeRemaining = Game.gameTimer;
        this.pointsTime = Game.gameTimer;
    }
    resetGame(){
        this.status = Game.STATUS.START;
        this.snakeBody = [];
        this.mode = 0;
        this.points = null
        this.pointsTime = Game.gameTimer;
        this.pointsTimeRemaining = this.pointsTime;
        this.direction = 'L';
        this.newDirection = null;
        this.pointsCaptured = null;
        this.score = 0;
        let x = Math.floor(playpanelWidth/(2*ball)) * ball, y = Math.floor(playpanelHeight/(2*ball))*ball
        this.snakeBody.push(new SquareBlock(x, y, headColorString));
        for(let i = 1; i<= startWithBlocks; i++)this.snakeBody.push(new SquareBlock(x+i*ball, y, tailColorString));
        this.generatepoints();
    }
    setGameMode(mode){
        this.mode = mode;
        this.fetchHighScore();
    }
    incrementScore(gain){
        this.score += gain;
    }
    fetchHighScore(){
        let keyName = Game.HIGHSCORE_KEYS[this.mode];
        let highScore = localStorage.getItem(keyName);
        if(highScore === null)Game.highScore = 0;
        else Game.highScore = parseInt(highScore);
    }
    updateHighScore(){
        Game.highScore = Math.max(Game.highScore, this.score);
        localStorage.setItem(Game.HIGHSCORE_KEYS[this.mode], Game.highScore.toString());
    }
    generatepoints(){
        let randInt = (upto) => Math.floor(Math.random()*upto);
        let duplicate = undefined, x, y;
        do{
            x = (1+randInt(playpanelWidth/ball-2))*ball;
            y = (1+randInt(playpanelHeight/ball-2))*ball;
            let points = new SquareBlock(x, y, pointsColorString)
            duplicate = this.snakeBody.find((block) => block.samePosition(points));
        }while (duplicate !== undefined);
        this.points = new SquareBlock(x, y, pointsColorString);
    }
    updateDirection(newDirection){
        this.newDirection = newDirection;
        playSound(KeyPressAudio)
    }
    loadDirection(){
        let dir = this.newDirection;
        this.newDirection = null;
        if(dir === null)return;
        switch (dir) {
            case 'L':
                if(this.direction !== 'R')this.direction = dir;
                break;
            case 'R':
                if(this.direction !== 'L')this.direction = dir;
                break;
            case 'U':
                if(this.direction !== 'D')this.direction = dir;
                break;
            case 'D':
                if(this.direction !== 'U')this.direction = dir;
                break;
        }
    }
    performMove(){
        this.loadDirection();
        let updatedPositions = this.snakeBody.map((x) => x.deepCopy());
        let nxt = new SquareBlock(updatedPositions[0].getMidX()+delta.get(this.direction)[0], updatedPositions[0].getMidY()+delta.get(this.direction)[1], headColorString);

        updatedPositions[0].setColor(tailColorString)
        if(this.pointsCaptured !== null){
            updatedPositions.splice(0, 1, this.pointsCaptured);
            this.pointsCaptured = null;
        }else updatedPositions.pop();
        updatedPositions.splice(0, 0, nxt);

        if(this.collisionHappens(updatedPositions)) {
            let copy = this.snakeBody.find((block, index) => index > 0 && block.samePosition(nxt));
            copy.setColor(pointsNotCapturedColorString);
            this.displayGameRunning();
            return false;
        }

        this.pointsTimeRemaining -= timeOut;
        this.incrementScore(Game.moveGain[this.mode]);
        this.snakeBody = updatedPositions;
        if(this.points.samePosition(nxt)){
            this.pointsCaptured = this.points;
            this.points = null;
            this.incrementScore(Game.pointsGain);
            playSound(CaptureAudio);
            this.generatepoints();
        }
        return true;
    }
    collisionHappens(positions){
        let copy = positions.find((block, index) => index > 0 && block.samePosition(positions[0]));
        return copy !== undefined;
    }
    displayObject(block){
        if(block === null)return;
        let topX = block.getMidX()-ball/2, topY = block.getMidY()-ball/2;
        for(let i = -1; i <= 1; i++)
            for(let j = -1; j <= 1; j++){
                let x1 = topX+i*playpanelWidth, y1 = topY+j*playpanelHeight;
                this.playpanelContext.fillStyle = block.getColor();
                this.playpanelContext.roundRect(x1, y1, ball, ball, roundRadius).fill();
                this.playpanelContext.strokeStyle = borderColorString;
                this.playpanelContext.roundRect(x1, y1, ball, ball, roundRadius).stroke();
            }
    }
    clearContexts(){
        this.playpanelContext.clearRect(0, 0, playpanelWidth, playpanelHeight);
        this.pointspanelContext.clearRect(0, 0, pointspanelWidth, pointspanelHeight);
    }
    displaypointspanel(){
        this.pointspanelContext.textBaseline = "middle";
        this.pointspanelContext.fillStyle = "#FFFFFF";

        let margin = 20, timerWidth = 0;
        let width = pointspanelWidth-2*margin, height = pointspanelHeight;

        let currentScoreString = "Score:" + (""+this.score).padStart(6) + "                                                                               ZA❤️AZ";
        let highScoreString = "Hi-Score:" + (""+Game.highScore).padStart(6);

        this.pointspanelContext.font = fontString(scoreFont, true, 30);
        this.pointspanelContext.textAlign = "start";
        this.pointspanelContext.fillText(currentScoreString, margin, height/2);
        this.pointspanelContext.textAlign = "end";
        this.pointspanelContext.fillText(highScoreString, margin+width, height/2);
    }
    display(){
        switch (this.status){
            case Game.STATUS.START: this.displayGameStart();return;
            case Game.STATUS.CHOICE: this.displayChoice(); return;
            case Game.STATUS.RUNNING: this.displayGameRunning(); return;
            case Game.STATUS.OVER: this.displayGameOver(); return;
            default: console.log("Invalid Game Status")
        }
    }
    displayGameRunning(){
        this.clearContexts();
        this.displaypointspanel();

        this.snakeBody.forEach((block) => this.displayObject(block));
        this.displayObject(this.points);
    }
    displayGameStart(){
        this.clearContexts();
        this.playpanelContext.fillStyle = "#000000";
        this.playpanelContext.textAlign = "center";
        this.playpanelContext.font = fontString(gameFont, false, 170);
        this.playpanelContext.fillText("SNAKE ZA❤️AZ", playpanelWidth/2, playpanelHeight/2-20);
        this.playpanelContext.font = fontString(gameFont, false, 36);
        this.playpanelContext.fillText("HIT SPACEBAR TO CONTINUE", playpanelWidth/2, playpanelHeight/2+20);
    }
    displayChoice(){
        this.clearContexts();
        this.playpanelContext.fillStyle = "#000000";
        this.playpanelContext.textAlign = "center";
        this.playpanelContext.font = fontString(gameFont, false, 170);
        this.playpanelContext.fillText("SNAKE ZA❤️AZ", playpanelWidth/2, playpanelHeight/2-30);
        this.playpanelContext.font = fontString(gameFont, false, 36);
        this.playpanelContext.fillText("HIT F for TO PLAY", playpanelWidth/2, playpanelHeight/2+50);
    }
    displayGameOver(){
        let imageData = this.playpanelContext.getImageData(0, 0, playpanelWidth, playpanelHeight);
        this.clearContexts();
        this.displaypointspanel();
        let blurredImageData = blurImage(imageData);
        this.playpanelContext.putImageData(blurredImageData, 0, 0);
        this.playpanelContext.fillStyle = "#000000";
        this.playpanelContext.textAlign = "center";
        this.playpanelContext.font = fontString(gameFont, false, 72);
        this.playpanelContext.fillText("TOTAL SCORE: "+this.score, playpanelWidth/2, playpanelHeight/2-20);
        this.playpanelContext.font = fontString(gameFont, false,36);
        this.playpanelContext.fillText("THANKS FOR PLAYING ❤️", playpanelWidth/2, playpanelHeight/2+30);
    }
}


function initializeGame(){
    document.getElementById("home").style.display = "none";
    pointspanel.style.display = "block";
    playpanel.style.display = "block";


    gameObject = new Game(playpanelContext, pointspanelContext);
    gameObject.resetGame();
    gameObject.status = Game.STATUS.START;
    gameObject.display();
    let timer = null;
    document.addEventListener('keydown', (event) => {
        let keycode = event.code;
        switch (gameObject.status){
            case Game.STATUS.START:
                if(keycode === "Space"){
                    gameObject.status = Game.STATUS.CHOICE;
                    gameObject.display();
                }
                break;
            case Game.STATUS.CHOICE:
                if(keycode === "KeyF" || keycode === "KeyT"){
                    if(keycode === "KeyF")gameObject.setGameMode(Game.MODE.FREE);

                    gameObject.status = Game.STATUS.RUNNING;
                    timer = setInterval(function(){
                        if(gameObject.performMove()){
                            gameObject.display();
                        }else{
                            clearInterval(timer);
                            gameObject.updateHighScore();
                            gameObject.status = Game.STATUS.OVER;
                            gameObject.display();
                            playSound(GameOverAudio);
                        }
                    }, timeOut);
                }
                break;
            case Game.STATUS.RUNNING:
                if(keycode.startsWith("Arrow"))
                    gameObject.updateDirection(keycode.charAt(5));
                break;
            case Game.STATUS.OVER:
                if(keycode === "Space"){
                    gameObject.status = Game.STATUS.START;
                    gameObject.resetGame();
                    gameObject.display();
                }
                break;
        }
    });


}

window.onresize = function(){window.location.reload();}

if(validWindowSize(windowWidth, windowHeight, ball))
    setTimeout(initializeGame, 3000);
else
    displayWindowSizeError();