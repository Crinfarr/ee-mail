const MAX_MSG_LEN = 1500;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
import createGetLogo from 'bimi-url';
import PostalMime from 'postal-mime';
let get_bimi_logo = createGetLogo();

export default {
	async email(message, env, ctx): Promise<void> {
		//filter email that isn't to ee-mail
		if (!message.to.endsWith('ee-mail.crinfarr.zip')) {
			//silently ignore
			console.warn(`Ignoring message to ${message.to}`);
			return;
		}
		//populate body
		let message_content = await PostalMime.parse(message.raw);
		let body_text = "";
		if (message_content.subject) body_text += `-# Subject: \`${message_content.subject}\``;

		let body = new FormData();
		if (message_content.from?.name && message_content.from.address) {
			body.append('username', `${message_content.from.name} (${message_content.from.address})`.substring(0, 80)); //fit in discord name limits
		} else {
			body.append('username', message_content.from?.address ?? message.from)
		}
		let maybe_avatar_url = await get_bimi_logo(message.from.split('@').at(-1) ?? '');
		if (maybe_avatar_url != null) {
			body.append('avatar_url', maybe_avatar_url);
		}

		if (!message_content.text && message_content.html) {
			body_text += (message_content.html.length > MAX_FILE_SIZE) ? "\n-# Truncated HTML attached" : "\n-# Full HTML attached"
			body.append("content", body_text);
			body.append("email.html", new Blob([message_content.html.substring(0, MAX_FILE_SIZE)]));
		}
		else if (message_content.text) {
			if (body_text.length + message_content.text.length + 1 > MAX_MSG_LEN) {
				body_text += (message_content.text.length > MAX_FILE_SIZE) ? "\n-# Truncated text attached" : "\n-# Full text attached"
				body.append("content", body_text);
				body.append("email.txt", new Blob([message_content.text.substring(0, MAX_FILE_SIZE)]));
			} else {
				body_text += "\n" + message_content.text;
				body.append("content", body_text);
			}
		}

		const DISCORD_REQ = new Request(env.DISCORD_WEBHOOK_URL + '?wait=true', {
			method: 'POST',
			body: body,
		});
		let res = await fetch(DISCORD_REQ);
		if (res.status != 200) console.warn(`Request finished with ${res.status} ${res.statusText}`);
	},
} satisfies ExportedHandler<Env>;
