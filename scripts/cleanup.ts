import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  await db.bookImage.deleteMany({})
  await db.bookTag.deleteMany({})
  await db.favorite.deleteMany({})
  await db.orderItem.deleteMany({})
  await db.order.deleteMany({})
  await db.book.deleteMany({})
  await db.category.deleteMany({})
  await db.tag.deleteMany({})
  await db.mediaFile.deleteMany({})
  await db.session.deleteMany({})
  await db.auditLog.deleteMany({})
  await db.contactMessage.deleteMany({})
  await db.siteVisit.deleteMany({})
  await db.user.deleteMany({})

  const defaults: Record<string, string> = {
    siteName: 'المكتبة الأدبية',
    tagline: 'مكتبة أدبية رقمية تضم إصدارات المؤلف وأعماله المنشورة والقادمة',
    welcomeText:
      'أهلًا بك في ركنٍ هادئ من عالم الكلمة؛ تجد هنا إصدارات المكتبة وأعمالها بين مطبوعٍ ورقيٍّ وأعمالٍ رقمية.',
    authorName: '',
    authorBio: '',
    contactEmail: '',
    contactPhone: '',
    logoImageId: '',
    authorPortraitId: '',
    storeEnabled: 'false',
    registrationEnabled: 'false',
    analyticsEnabled: 'false',
    paymentEnabled: 'false',
    paymentProvider: '',
    currency: 'KWD',
    primaryColor: '#C6A15B',
    backgroundColor: '#101010',
    ivoryColor: '#F4EFE5',
    seoTitle: '',
    seoDescription: '',
    socialLinks: JSON.stringify({ x: '', instagram: '', facebook: '', telegram: '', whatsapp: '', youtube: '' }),
  }
  for (const [key, value] of Object.entries(defaults)) {
    await db.siteSetting.update({ where: { key }, data: { value } })
  }

  console.log('users:', await db.user.count())
  console.log('books:', await db.book.count())
  console.log('categories:', await db.category.count())
  console.log('tags:', await db.tag.count())
  console.log('media:', await db.mediaFile.count())
  console.log('orders:', await db.order.count())
  console.log('messages:', await db.contactMessage.count())
  console.log('visits:', await db.siteVisit.count())
  console.log('pages:', await db.page.count())
  const name = await db.siteSetting.findUnique({ where: { key: 'siteName' } })
  console.log('siteName:', name?.value)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
