export const shortenFileName = (name: string, maxLength: number = 10): string => {
    const parts = name.split('.');
    const extension = parts.pop(); // Extract extension
    const fileName = parts.join('.'); // Remaining file name
  
    if (fileName.length <= maxLength) {
      return name; // No need to shorten
    }
  
    const shortened = '...' + fileName.slice(-(maxLength - 3)); // Add "..." at the beginning
    return `${shortened}.${extension}`;
}

export const shortenText = (text: string, maxLength: number = 10): string => {
  if (text.length <= maxLength) {
      return text; // No need to shorten
  }

  return text.length > maxLength ? text.slice(0, maxLength - 3) + "..." : text;
};

export const formatDate = (json: { date: string; timezone: string }): string => {
    const utcDate = new Date(json.date + 'Z'); // Append 'Z' to handle UTC
    
    const day = utcDate.getUTCDate();
    const suffix = (day % 10 === 1 && day !== 11) ? 'st' 
                  : (day % 10 === 2 && day !== 12) ? 'nd' 
                  : (day % 10 === 3 && day !== 13) ? 'rd' 
                  : 'th';
  
    return utcDate.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).replace(/\d+/, `${day}${suffix}`);
}

export const shortFormatDate = (json: { date: string; timezone: string }):string => {
    const utcDate = new Date(json.date + 'Z'); // Append 'Z' to handle UTC
    const now = new Date();

    const hours = utcDate.getUTCHours().toString().padStart(2, '0');
    const minutes = utcDate.getUTCMinutes().toString().padStart(2, '0');
    const day = utcDate.getUTCDate();
    const month = (utcDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = utcDate.getUTCFullYear().toString().slice(-2);

    const isToday = utcDate.toDateString() === now.toDateString();

    return isToday ? `${hours}:${minutes}` : `${hours}:${minutes} ${day}/${month}/${year}`;
}

export const formatInferenceResponse = (text:string) => {
    return text
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Convert bold (**text**) to <strong>
        .replace(/- (.+?):/g, "<br><strong>$1:</strong>") // Convert "- Title:" to a bolded title with a line break
        .replace(/- /g, "<br>• ") // Convert remaining "-" to bullet points with line breaks
        .replace(/https?:\/\/[^\s]+/g, (url) => {
            var trailing = '';
            if( url[url.length - 1] === '.' ) {
                url = url.slice(0, -1); // Remove trailing period if present
                trailing = '.';
            }
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trailing}`;
        });
};

export const formatMessageResponse = (text:string) => {
  return text
      .replace(/https?:\/\/[^\s]+/g, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`); // Convert URLs to clickable links
};

export const getInitials = (text:string) => {
  	if (!text) return '';

  	const words = text.trim().split(' ').filter(Boolean);

  	if (words.length === 1) {
    	return words[0].substring(0, 2).toUpperCase();
  	}

  	return (words[0][0] + words[1][0]).toUpperCase();
};