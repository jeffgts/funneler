import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import 'dotenv/config';

let allowedHosts = ['localhost'];
if (process.env.TAILNET_HOSTNAME) {
	allowedHosts.push(process.env.TAILNET_HOSTNAME);
}

const APP_PORT = process.env.APP_PORT ? parseInt(process.env.APP_PORT) : 5173;

export default defineConfig({
	server: {
		host: '127.0.0.1',
		port: APP_PORT,
		allowedHosts: allowedHosts,
	},
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: adapter()
		})
	]
});
