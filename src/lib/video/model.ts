/**
 * Represents video thumbnail metadata
 */
export interface Thumbnail {
  /**
   * URL of the thumbnail image
   */
  url: string;
  
  /**
   * Optional width in pixels
   */
  width?: number;
  
  /**
   * Optional height in pixels
   */
  height?: number;
}

/**
 * API response interface for video download information
 */
export interface VideoInfo {
  /**
   * Original title of the video
   */
  title: string;
  
  /**
   * Local filename for the downloaded video
   */
  filename: string;
  
  /**
   * Best available thumbnail URL
   */
  thumbnail: string;
  
  /**
   * Video duration in seconds
   */
  duration: number;
  
  /**
   * Content creator/author name
   */
  uploader: string;
  
  /**
   * File size in human-readable format (e.g., "12.34 MB")
   */
  fileSize: string;
}

/**
 * Raw video metadata from yt-dlp source
 */
export interface VideoMetadata {
  /**
   * Original video title
   */
  title: string;
  
  /**
   * Primary thumbnail URL (optional)
   */
  thumbnail?: string;
  
  /**
   * Array of available thumbnails with resolution options
   */
  thumbnails?: Thumbnail[];
  
  /**
   * Video duration in seconds
   */
  duration: number;
  
  /**
   * Content creator/author name
   */
  uploader: string;
}