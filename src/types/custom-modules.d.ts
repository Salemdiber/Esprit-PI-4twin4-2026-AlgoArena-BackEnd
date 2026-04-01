declare module 'openai' {
	export interface OpenAIConfig { apiKey?: string; apiKeyPath?: string; [key: string]: any }
	export default class OpenAI {
		constructor(cfg?: OpenAIConfig);
		[key: string]: any;
	}
}

declare module 'dockerode' {
	export class Container {
		id?: string;
		[key: string]: any;
	}

	export class DockerClass {
		constructor(cfg?: any);
		getContainer(id: string): Container;
		[key: string]: any;
	}

	// Provide a value export that has a Container member so `Docker.Container` is valid
	const Docker: (typeof DockerClass) & { Container: typeof Container };

	export = Docker;
	export { Container };
}
