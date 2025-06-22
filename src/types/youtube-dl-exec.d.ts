declare module 'youtube-dl-exec' {
    interface YoutubeDlOptions {
        output?: string;
        format?: string;
        mergeOutputFormat?: string;
        noCheckCertificates?: boolean;
        noWarnings?: boolean;
        preferFreeFormats?: boolean;
        addHeader?: string[];
        bufferSize?: string;
        httpChunkSize?: string;
        dumpSingleJson?: boolean;
        [key: string]: any;
    }

    interface YoutubeDlResponse {
        title?: string;
        thumbnail?: string;
        thumbnails?: Array<{
            url: string;
            width?: number;
            height?: number;
        }>;
        duration?: number;
        uploader?: string;
        channel?: string;
        [key: string]: any;
    }

    function youtubeDl(url: string, options?: YoutubeDlOptions): Promise<YoutubeDlResponse | string>;
    
    export = youtubeDl;
}