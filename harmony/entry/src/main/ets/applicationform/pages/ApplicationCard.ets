let applicationCardStorage = new LocalStorage();

@Entry(applicationCardStorage)
@Component
struct ApplicationCard {
  @LocalStorageProp('trackedCount') trackedCount: number = 0;
  @LocalStorageProp('pendingCount') pendingCount: number = 0;
  @LocalStorageProp('applicationStage') applicationStage: string = '待追踪';
  @LocalStorageProp('nextAction') nextAction: string = '添加岗位后生成今日行动';
  @LocalStorageProp('jobTitle') jobTitle: string = '孔明职配';
  @LocalStorageProp('empiricalCoverage') empiricalCoverage: number = 0;
  @LocalStorageProp('growthCompletedCount') growthCompletedCount: number = 0;
  @LocalStorageProp('growthTaskCount') growthTaskCount: number = 0;
  @LocalStorageProp('routePage') routePage: string = 'jobs';
  @LocalStorageProp('updatedAt') updatedAt: string = '尚未同步';

  private compactUpdatedAt(): string {
    const value = this.updatedAt.trim();
    const separator = value.lastIndexOf(' ');
    return separator >= 0 ? value.slice(separator + 1) : value;
  }

  private targetPage(): string {
    if (this.routePage === 'home' || this.routePage === 'resume' || this.routePage === 'jobs' ||
      this.routePage === 'interview' || this.routePage === 'growth') {
      return this.routePage;
    }
    return 'home';
  }

  build() {
    Column({ space: 5 }) {
      Row() {
        Text('今日求职行动')
          .fontSize(15)
          .fontWeight(FontWeight.Bold)
          .fontColor('#0F172A')
        Blank()
        Text(`${this.applicationStage} · ${this.pendingCount} 项`)
          .fontSize(10)
          .fontWeight(FontWeight.Medium)
          .fontColor('#2563EB')
          .maxLines(1)
      }
      .width('100%')

      Text(this.nextAction)
        .fontSize(13)
        .fontWeight(FontWeight.Medium)
        .fontColor('#334155')
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')

      Row() {
        Text(this.growthTaskCount > 0
          ? `成长证据 ${this.growthCompletedCount}/${this.growthTaskCount}`
          : '成长任务待生成')
          .fontSize(10)
          .fontColor('#64748B')
        Blank()
        Text(`实证 ${this.empiricalCoverage}%`)
          .fontSize(10)
          .fontWeight(FontWeight.Medium)
          .fontColor('#0F766E')
      }
      .width('100%')

      Progress({ value: this.empiricalCoverage, total: 100, type: ProgressType.Linear })
        .width('100%')
        .height(5)
        .color('#0F766E')
        .backgroundColor('#CCFBF1')
        .borderRadius(3)

      Row({ space: 4 }) {
        Text(this.jobTitle)
          .fontSize(9)
          .fontColor('#64748B')
          .maxLines(1)
          .layoutWeight(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(`${this.trackedCount} 岗位`)
          .fontSize(9)
          .fontColor('#94A3B8')
          .maxLines(1)
        Text(this.compactUpdatedAt())
          .fontSize(9)
          .fontColor('#94A3B8')
          .maxLines(1)
      }
      .width('100%')
    }
    .width('100%')
    .height('100%')
    .padding(12)
    .backgroundColor('#F8FBFF')
    .onClick(() => {
      postCardAction(this, {
        action: 'router',
        bundleName: 'cn.kongming.jobmatch',
        moduleName: 'entry',
        abilityName: 'EntryAbility',
        params: { page: this.targetPage() }
      });
    })
  }
}
