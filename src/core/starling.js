import retry from "p-retry"
import { Pulse } from "@killiandvcz/pulse";
import { Message } from "../messages/message";
import { Request } from "../messages/request";
import { Response } from "../messages/response";
import { Methods } from "$/managers/methods";
import { RequestContext } from "./context";

export class Starling {
    constructor() {
        this.websocket = null;
        this.connecting = false;
        this.events = new Pulse();
        this.requests = new Pulse();
        /** @type {Map<string, import('../messages/message').Message>} */
        this.outgoing = new Map();
        /** @type {Map<string, import('../messages/message').Message>} */
        this.incoming = new Map();
        this.methods = new Methods(this);

        this.listeners = new Pulse();
        
    }
    connecting = false;
    
    /**
     * @param {String} method 
     * @param {import('./method').MethodHandler} handler 
     */
    method = (method, handler) => this.methods.register(method, handler);


    connect = async (url, options) => {
        if (this.connecting) return;
        this.connecting = true;
        
        url = url instanceof URL ? url : new URL(url);
        if (url.protocol !== "ws:" && url.protocol !== "wss:") {
            this.connecting = false;
            throw new Error("Invalid URL protocol. Use ws or wss.");
        }
        
        try {
            await retry(async () => {
                return new Promise((resolve, reject) => {
                    if (this.websocket && (this.websocket.readyState === WebSocket.OPEN || this.websocket.readyState === WebSocket.CONNECTING)) {
                        this.websocket.close();
                    }
                    
                    this.websocket = new WebSocket(url, "helios-starling");
                    
                    const connectionTimeout = setTimeout(() => reject(new Error("Connection timed out")), options?.timeout || 10000);
                    
                    this.websocket.onopen = (event) => {
                        this.connecting = false;
                        clearTimeout(connectionTimeout);
                        console.log("CONNECTED TO STARLING", event);
                        this.events.emit("starling:connected", { starling: this, event });
                        resolve(this.websocket);
                    };
                    
                    this.websocket.onerror = (event) => {
                        clearTimeout(connectionTimeout);
                        this.events.emit("starling:error", { starling: this, event });
                        reject(new Error("Connection failed"));
                    };
                    
                    this.websocket.onmessage = (event) => {
                        this.events.emit("starling:message:raw", { starling: this, event });
                        this.handle(event.data);
                    };
                    
                    this.websocket.onclose = (event) => {
                        if (event.code !== 1000 && !this.connecting) {
                            console.log("Attempting to reconnect...");
                            this.events.emit("starling:disconnected", { starling: this, event });
                            setTimeout(() => {
                                this.connect(url, options);
                            }, 1000);
                        }
                    };
                })
            }, { 
                retries: options?.retries || 5,
                factor: options?.factor || 2,
                minTimeout: options?.minTimeout || 1000,
                maxTimeout: options?.maxTimeout || 10000,
                randomize: true,
                onFailedAttempt: (error) => {
                    console.warn(`Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`);
                }
            });
        } catch (error) {
            console.error("All connection attempts failed", error);
            this.connecting = false;
            throw error;
        }
    }
    
    /** 
    * @param {import('../messages/message').Message} message
    */
    #emit = message => {
        try {
            this.outgoing.set(message.id, message);
            const string = message.toString();            
            this.events.once(`message:${message.id}:ack`, () => {
                message.acked = true;
                this.outgoing.delete(message.id);
                this.events.emit("message:ack", { starling: this, message });
            });
            
            retry(async () => new Promise((resolve, reject) => {
                this.websocket.send(string);
                this.events.emit("message:emitted", { starling: this, message });
                setTimeout(() => {
                    if (message.acked) return resolve();
                    else reject(new Error("Message timed out"));
                }, 5000);
            }), {
                retries: 5,
            });
        } catch (error) {
            this.events.emit("message:emitted:error", { starling: this, error });
        }
    }
    
    /** @param {string | ArrayBufferLike | Blob | ArrayBufferView} data */
    send = (data) => {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(data);
            return true;
        }
        return false;
    };
    
    /** 
     * @param {any} data
     * @param {import("../messages/message").MessageOptions} options
     */
    json = (data, options) => this.#emit(Message.outgoing(data, {...options, type: "json" }));
    
    /** 
     * @param {any} data
     * @param {import("../messages/message").MessageOptions} options
     */
    text = (data, options) => this.#emit(Message.outgoing(data, {...options, type: "text" }));
    
    /** 
     * @param {any} data
     * @param {import("../messages/message").MessageOptions} options
     */
    binary = (data, options) => this.#emit(Message.outgoing(data, {...options, type: "binary" }));
    
    /**
    * @param {string} method
    * @param {any} payload
    * @param {import("../messages/request").RequestOptions} options
    * @returns {Promise<import('../messages/response').Response>}
    */
    request = (method, payload, options) => new Promise((resolve, reject) => {
        const request = Request.outgoing(payload, { method, ...options });
        this.#emit(request);
        const timeout = options?.timeout || 5000;
        const timer = setTimeout(() => this.requests.emit(`request:${request.id}:error`, new Error("Request timed out")), timeout);
        const clear = () => {
            this.requests.off(`request:${request.id}:response`);  
            this.requests.off(`request:${request.id}:error`);
            clearTimeout(timer);
        }
        this.requests.once(`request:${request.id}:response`, (event) => {
            clear();
            resolve(event.data);
        });
        this.requests.once(`request:${request.id}:error`, (event) => {
            clear();
            reject(event.data || new Error("Unknown error"));
        });
    });

    /**
    * @param {import('../messages/request').Request} request 
    * @param {any} payload
    * @param {import('../messages/response').ResponseOptions} options
    */
    respond = (request, payload, options) => {
        if (!(request instanceof Request)) throw new Error("[request] is not an instance of Request");
        if (!request.id) throw new Error("[request] does not have an id");
        const incoming = this.incoming.get(request.id);
        if (!incoming) throw new Error("[request] is not an incoming request");
        const response = Response.outgoing(payload, { ...options, requestId: request.id });
        this.#emit(response);
    }

    /**
    * @param {import('../messages/message').Message} message
    */
    ack = (message) => {
        if (!(message instanceof Message)) throw new Error("[message] is not an instance of Message");
        if (!message.id) throw new Error("[message] does not have an id");
        const idBytes = new TextEncoder().encode(message.id);
        const buffer = new Uint8Array(2 + idBytes.length);
        buffer[0] = 0x01; // ACK
        buffer[1] = idBytes.length;
        buffer.set(idBytes, 2);
        this.send(buffer);
    }


    /** @param {String | ArrayBuffer | Uint8Array} message */
    handle = message => {
        let type = message instanceof ArrayBuffer || message instanceof Uint8Array ? "binary" : typeof message === "string" ? "text" : null;
        let incoming;
        if (type === "text") {
            let data;
            try { data = JSON.parse(message); type = "json"; } catch(error) { data = message; type = "text"; }
            if (type === "json") {
                if (data?.headers?.protocol === "helios-starling") {
                    const { headers, data: payload } = data;
                    if (headers?.type === "request") {
                        incoming = Request.incoming({
                            headers: { ...headers, type: "request" },
                            data: payload,
                        });
                    } else if (headers?.type === "response") {
                        incoming = Response.incoming({
                            headers: { ...headers, type: "response" },
                            data: payload,
                        });
                    } else if (headers?.type === "json") {
                        incoming = Message.incoming({
                            headers: { ...headers, type: "json" },
                            data: payload,
                        });
                    } else if (headers?.type === "text") {
                        incoming = Message.incoming({
                            headers: { ...headers, type: "text" },
                            data: payload,
                        });
                    }
                } else {
                    incoming = Message.incoming({
                        headers: {
                            type: "text",
                        },
                        data: message,
                    });
                }
            } else {
                incoming = Message.incoming({
                    headers: {
                        type: "text",
                    },
                    data: message,
                });
            }
        } else if (type === "binary") {
            const bytes = message instanceof ArrayBuffer ? new Uint8Array(message) : message;
            if (bytes[0] === 0x01) {
                // ACK
                const length = bytes[1];
                const idBytes = bytes.slice(2, 2 + length);
                const id = new TextDecoder().decode(idBytes);
                this.events.emit(`message:${id}:ack`, { starling: this, id });
            }
        }

        if (incoming) {    
            this.ack(incoming);
            this.incoming.set(incoming.id, incoming);

            if (incoming instanceof Response) {
                this.requests.emit(`request:${incoming.headers.requestId}:response`, incoming);
            }
            if (incoming instanceof Request) {       
                const method = this.methods.get(incoming.method);
                if (!method) this.respond(incoming, { error: "Method not found" }, { status: 404 });
                else {
                    const context = new RequestContext(this, incoming);
                    method.execute(context)
                }
            }
            if (incoming instanceof Message) {
                if (incoming.headers.topic) this.listeners.emit(incoming.headers.topic, incoming);
            }
        }
    }
    
    close = () => {
        if (this.websocket) {
            this.websocket.close(1000, "Normal closure");
            this.websocket = null;
        }
    };
    
    onconnected = (callback) => this.events.on("starling:connected", callback);


    /**
     * @param {String} pattern 
     * @param {(message: import('../messages/message').Message) => void} callback
     * @returns
     */
    on = (pattern, callback) => this.listeners.on(pattern, event => callback(event.data));

}