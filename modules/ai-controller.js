export class AIController {
    constructor() {
        this.controlBtn = document.getElementById('ai-control-btn');
        this.panel = document.getElementById('ai-control-panel');
        this.startBtn = document.getElementById('ai-start-btn');
        this.stopBtn = document.getElementById('ai-stop-btn');
        this.statusEl = document.getElementById('ai-status');
        this.objectiveInput = document.getElementById('ai-objective-input');
        this.cursor = document.getElementById('ai-cursor');

        this.isRunning = false;
        this.objective = '';
        this.mousePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.conversationHistory = [];

        this.init();
    }

    init() {
        if (!this.controlBtn || !this.panel || !this.startBtn || !this.stopBtn || !this.statusEl || !this.cursor || !this.objectiveInput) {
            console.error('AI Controller UI elements not found.');
            return;
        }

        this.controlBtn.addEventListener('click', () => this.togglePanel());
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
    }

    togglePanel() {
        this.panel.classList.toggle('visible');
    }

    updateStatus(message) {
        this.statusEl.textContent = message;
        console.log(`[AI Status] ${message}`);
    }

    async start() {
        this.objective = this.objectiveInput.value.trim();
        if (!this.objective) {
            this.updateStatus('Please provide an objective.');
            return;
        }

        this.isRunning = true;
        this.startBtn.style.display = 'none';
        this.stopBtn.style.display = 'block';
        this.cursor.classList.add('visible');
        this.moveMouse(this.mousePos.x, this.mousePos.y);
        this.updateStatus(`Starting AI with objective: ${this.objective}`);
        
        this.conversationHistory = [];

        this.runLoop();
    }

    stop() {
        this.isRunning = false;
        this.startBtn.style.display = 'block';
        this.stopBtn.style.display = 'none';
        this.cursor.classList.remove('visible');
        this.updateStatus('AI stopped by user.');
    }

    moveMouse(x, y) {
        this.mousePos = { x, y };
        this.cursor.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }

    async click(x, y) {
        this.moveMouse(x, y);

        // Give mouse time to move
        await new Promise(resolve => setTimeout(resolve, 300));

        const elementToClick = document.elementFromPoint(x, y);
        if (elementToClick) {
            this.updateStatus(`Clicking on ${elementToClick.tagName} at (${x}, ${y})`);
            elementToClick.click();
        } else {
            this.updateStatus(`Could not find an element to click at (${x}, ${y})`);
        }
    }

    async runLoop() {
        if (!this.isRunning) return;

        this.updateStatus('Capturing screen...');
        await new Promise(resolve => setTimeout(resolve, 500)); // prevent flicker
        try {
            const canvas = await html2canvas(document.body, {
                useCORS: true,
                logging: false,
                width: window.innerWidth,
                height: window.innerHeight,
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
                x: 0,
                y: 0,
            });
            const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            
            this.updateStatus('Thinking...');
            
            this.conversationHistory.push({
                role: 'user',
                content: [{
                    type: "image_url",
                    image_url: { url: imageDataUrl },
                }]
            });
            
            // only send the last 4 messages (2 turns) to the language model
            this.conversationHistory = this.conversationHistory.slice(-4);
            
            const completion = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `You are an AI assistant controlling a web page. Your goal is: "${this.objective}".
The user has provided a screenshot of the page. Your mouse pointer is indicated by a red bullseye cursor.
Your task is to analyze the image and decide the next best action to achieve the objective.
You can move the mouse, or click. Respond with your action as JSON, and a brief thought process.

Respond with JSON in this exact format:
{
  "thought": "Your reasoning for the action goes here.",
  "action": "move" | "click",
  "x": <target_x_coordinate>,
  "y": <target_y_coordinate>
}
The top-left corner is (0,0). The current mouse position is (${Math.round(this.mousePos.x)}, ${Math.round(this.mousePos.y)}).
The screen resolution is ${window.innerWidth}x${window.innerHeight}.
Only output the JSON. No other text.`,
                    },
                    ...this.conversationHistory,
                ],
                json: true,
            });

            this.conversationHistory.push(completion);

            const result = JSON.parse(completion.content);

            if (result.thought) {
                 this.updateStatus(`Thought: ${result.thought}`);
            }

            if (result.action === 'move') {
                await this.moveMouse(result.x, result.y);
            } else if (result.action === 'click') {
                await this.click(result.x, result.y);
            } else {
                 this.updateStatus('Unknown action received from AI.');
            }

        } catch (error) {
            console.error("AI loop error:", error);
            this.updateStatus(`An error occurred: ${error.message}`);
            this.stop();
            return;
        }

        setTimeout(() => this.runLoop(), 2000); // Wait 2 seconds before next action
    }
}