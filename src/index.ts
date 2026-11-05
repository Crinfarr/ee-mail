const MAX_MSG_LEN = 1500;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
import createGetLogo from 'bimi-url';
let get_bimi_logo = createGetLogo();

export default {
	async email(message, env, ctx): Promise<void> {
		//filter email that isn't to ee-mail
		if (!message.to.endsWith('ee-mail.crinfarr.zip')) {
			//silently ignore
			console.warn(`Ignoring message to ${message.to}`);
			return;
		}
		console.info(`New email from ${message.from} at ${new Date().toISOString()}`);
		let body = new FormData();
		body.append('username', `From: ${message.from}, to: ${message.to}`.substring(0, 80)); //fit in discord name limits
		let maybe_avatar_url = await get_bimi_logo(message.from.split('@').at(-1) ?? '');
		if (maybe_avatar_url != null) {
			console.info('Retrieved BIMI url');
			body.append('avatar_url', maybe_avatar_url);
		} else {
			console.info('No BIMI url resolved');
		}
		//populate body
		let content = '';
		for await (const chunk of message.raw) content += String.fromCharCode(...chunk);
		console.info('Finished collecting message content');
		//if everything fits in one message:
		if (content.length < MAX_MSG_LEN) {
			console.info('Content fits in one message');
			body.append('content', content);
		} else if (content.length < MAX_FILE_SIZE) {
			//if everthing fits in one attachment
			console.info('Content fits in one attachment');
			body.append('content', content.substring(0, 500) + '[...]\n-# Full content attached');
			body.append('message_content.txt', new Blob([content]));
		} else {
			//fit as much as we can
			console.info('Truncated content');
			body.append('content', '## Size limit exceeded! Truncated message attached');
			body.append('files[0]', content.substring(0, MAX_FILE_SIZE));
		}

		const DISCORD_REQ = new Request(env.DISCORD_WEBHOOK_URL + '?wait=true', {
			method: 'POST',
			body: body,
		});
		let res = await fetch(DISCORD_REQ);
		console.log(`Request finished with ${res.status} ${res.statusText}`);
		console.debug(
			`${await (async () => {
				let s = '';
				for await (const chunk of res.body ?? '') s += String.fromCharCode(...chunk);
				return s;
			})()}`,
		);
	},
} satisfies ExportedHandler<Env>;
