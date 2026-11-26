# Funneler

A quick example using vite and sveltekit of how to integrate Tailscale's Funnel feature so that you can expose an application to the web for development purposes.

## Why?

You're probably already running tailscale for remote access and tailnetting; Funnel can really help out if you need to test Oauth flows, webhooks, or just showing a local app you're working on with a friend remotely.

## Pre-requisites

* a working install of tailscale connected to a tailnet
* Funnel needs to be enabled on the tailnet:
  * > Use the tailscale funnel command to enable Funnel. The command triggers a web interface that prompts you to approve enabling Funnel. After you approve it, Tailscale will create valid HTTPS certificates for your tailnet and add a funnel node attribute to your tailnet policy file. [ref](https://tailscale.com/docs/features/tailscale-funnel#get-started-with-funnel)

## Get started

```bash
$ git clone https://github.com/jeffgts/funneler.git
$ cd ./funneler && pnpm install
$ pnpm run funnel
```

## How it works

The funneler.ts script takes arguments for a/ the port you want the development server to run on, as well as the specific package.jsopn script you want to run. It takes these and then runs `tailscale funnel`, which creates a world-visible tunnel from a TLS-terminated url to the local system on the port you specified. The script also sets the port value as an environment variable, which is then read by the vite configurtation file and used when starting up the development server.

Under the hood the script uses the command `tailscale whoami` to get additional information from the current tailnet so we can deterministically set the 'remote' / proxied url to use.

### Prior art

* ngrok
* Cloudflare tunnels
* localtunnel
* Tunnelbear
* etc.

