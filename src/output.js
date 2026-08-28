export function printJson(value, stream = process.stdout) {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printItems(items, stream = process.stdout) {
  if (items.length === 0) {
    stream.write("No items found. Google may have changed the web UI; try --json or `gvoice open`.\n");
    return;
  }

  items.forEach((item, index) => {
    stream.write(`${index + 1}. ${item.text}\n`);
  });
}

export function printThread(thread, stream = process.stdout) {
  const heading = [thread.title, thread.participant].filter(Boolean).join(" — ");
  if (heading) stream.write(`${heading}\n\n`);

  for (const message of thread.messages) {
    const metadata = [message.sender, message.timestamp].filter(Boolean).join(" · ");
    if (metadata) stream.write(`${metadata}\n`);
    if (message.text) stream.write(`${message.text}\n`);
    if (message.attachments > 0) {
      stream.write(`[${message.attachments} image attachment(s)]\n`);
    }
    stream.write("\n");
  }
}

export function printRecent(result, stream = process.stdout) {
  if (result.messages.length === 0) {
    stream.write("No matching text messages found.\n");
    return;
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  for (const message of result.messages) {
    const arrow = message.direction === "incoming" ? "←" : message.direction === "outgoing" ? "→" : "·";
    const metadata = [
      `${arrow} ${formatter.format(new Date(message.timestamp))}`,
      message.participant,
      `thread ${message.thread}`,
    ]
      .filter(Boolean)
      .join(" · ");
    stream.write(`${metadata}\n${message.text}\n\n`);
  }

  if (result.truncated) {
    stream.write("More matching messages exist; increase --limit to include them.\n");
  }
  if (result.sourceTruncated) {
    stream.write("The time window spans more than Google's 100-thread snapshot; results may be incomplete.\n");
  }
}
