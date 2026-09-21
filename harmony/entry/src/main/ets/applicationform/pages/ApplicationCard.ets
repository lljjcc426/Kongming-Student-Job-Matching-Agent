let applicationCardStorage = new LocalStorage();

@Entry(applicationCardStorage)
@Component
struct ApplicationCard {
  @LocalStorageProp('trackedCount') trackedCount: number = 0;
  @LocalStorageProp('pendingCount') pendingCount: number = 0;
  @LocalStorageProp('applicationStage') applicationStage: string = '待追踪';
  @LocalStorageProp('nextAction') nextAction: string = '添加岗位后生成今日行动';
  @LocalStorageProp('jobTitle') jobTitle: string = '孔明职配';
  @LocalStorageProp('updatedAt') updatedAt: string = '尚未同步';

  build() {
    FormLink({ action: 'router', abilityName: 'EntryAbility', params: { page: 'jobs' } }) {
      Column({ space: 8 }) {
        Row() {
          Text('今日求职行动')
            .fontSize(17)
            .fontWeight(FontWeight.Bold)
            .fontColor('#0F172A')
          Blank()
          Text(`${this.applicationStage} · ${this.pendingCount} 项待办`)
            .fontSize(12)
            .fontWeight(FontWeight.Medium)
            .fontColor('#2563EB')
        }
        .width('100%')

        Text(this.nextAction)
          .fontSize(14)
          .fontWeight(FontWeight.Medium)
          .fontColor('#334155')
          .maxLines(3)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')

        Blank()

        Row() {
          Text(this.jobTitle)
            .fontSize(11)
            .fontColor('#64748B')
            .maxLines(1)
          Blank()
          Text(`已追踪 ${this.trackedCount} 个岗位`)
            .fontSize(11)
            .fontColor('#64748B')
        }
        .width('100%')

        Text(`更新于 ${this.updatedAt}`)
          .fontSize(10)
          .fontColor('#94A3B8')
          .width('100%')
      }
      .width('100%')
      .height('100%')
      .padding(16)
      .backgroundColor('#F8FBFF')
    }
  }
}
