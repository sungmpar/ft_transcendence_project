
export abstract class GameImageService {
  private static imagesMap = new Map<string, HTMLImageElement>();

  public static async loadImages(): Promise<void> {
    const promises: Promise<void>[] = [];

		const imageElement = new Image();
		imageElement.src = await require("@/images/background.png");
		promises.push(imageElement.decode());
		this.imagesMap.set("space", imageElement);

		const imageElement2 = new Image();
		imageElement2.src = await require("@/images/winter.jpeg");
		promises.push(imageElement2.decode());
		this.imagesMap.set("winter", imageElement2);

    await Promise.all(promises);
  }

  public static fetchImage(background: string): HTMLImageElement {
		return this.imagesMap.get(background)!;
  }
}
