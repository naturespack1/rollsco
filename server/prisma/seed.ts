import { PrismaClient, AdminRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.item.deleteMany();
  await prisma.category.deleteMany();
  await prisma.adminStore.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.store.deleteMany();

  const store1 = await prisma.store.create({
    data: { name: "Roll's & Co. Boring Road", address: 'Boring Road, Patna', isOpen: true, acceptingOrders: true }
  });
  const store2 = await prisma.store.create({
    data: { name: "Roll's & Co. Kankarbagh", address: 'Kankarbagh, Patna', isOpen: true, acceptingOrders: true }
  });

  const admin = await prisma.adminUser.create({
    data: {
      email: 'admin@rollsandco.com',
      name: 'Super Admin',
      passwordHash: await bcrypt.hash('admin123', 10),
      role: AdminRole.SUPER_ADMIN
    }
  });

  await prisma.adminStore.create({
    data: { adminId: admin.id, storeId: store1.id }
  });
  await prisma.adminStore.create({
    data: { adminId: admin.id, storeId: store2.id }
  });

  const catRoll = await prisma.category.create({ data: { name: 'Roll', sort: 1 } });
  const catBurger = await prisma.category.create({ data: { name: 'Burgers', sort: 2 } });
  const catBev = await prisma.category.create({ data: { name: 'Beverages', sort: 3 } });
  const catExtra = await prisma.category.create({ data: { name: 'Extras', sort: 4 } });
  const catCombo = await prisma.category.create({ data: { name: 'Combos', sort: 5 } });

  const itemsData = [
    // Rolls
    { storeId: store1.id, categoryId: catRoll.id, name: 'Chicken Kathi Roll', description: 'Soft paratha stuffed with spicy chicken tikka, onions & mint chutney.', price: 120, stock: 25, gstRate: 5, hsnCode: '2106', imageUrl: '/images/rolls.jpg', isBestseller: true },
    { storeId: store1.id, categoryId: catRoll.id, name: 'Paneer Tikka Roll', description: 'Grilled paneer cubes with capsicum in a whole wheat wrap.', price: 100, stock: 15, gstRate: 5, hsnCode: '2106', imageUrl: '/images/rolls.jpg' },
    { storeId: store1.id, categoryId: catRoll.id, name: 'Egg Roll', description: 'Classic double egg roll with onions, green chilies & special sauce.', price: 70, stock: 30, gstRate: 5, hsnCode: '2106', imageUrl: '/images/rolls.jpg' },
    // Burgers
    { storeId: store1.id, categoryId: catBurger.id, name: 'Classic Chicken Burger', description: 'Juicy chicken patty, lettuce, tomato, cheese & secret sauce.', price: 150, stock: 20, gstRate: 5, hsnCode: '2106', imageUrl: '/images/burgers.jpg', isBestseller: true },
    { storeId: store1.id, categoryId: catBurger.id, name: 'Veggie Delight Burger', description: 'Crispy veg patty, coleslaw, gherkins & cheese slice.', price: 120, stock: 18, gstRate: 5, hsnCode: '2106', imageUrl: '/images/burgers.jpg' },
    { storeId: store1.id, categoryId: catBurger.id, name: 'Double Trouble Burger', description: 'Two beef-style patties, double cheese, caramelized onions.', price: 220, stock: 8, gstRate: 5, hsnCode: '2106', imageUrl: '/images/burgers.jpg' },
    // Beverages
    { storeId: store1.id, categoryId: catBev.id, name: 'Cold Coffee', description: 'Creamy cold coffee with whipped cream topping.', price: 90, stock: 40, gstRate: 12, hsnCode: '2202', imageUrl: '/images/beverages.jpg' },
    { storeId: store1.id, categoryId: catBev.id, name: 'Fresh Lime Soda', description: 'Sweet or salted lime soda with fresh mint.', price: 60, stock: 50, gstRate: 12, hsnCode: '2202', imageUrl: '/images/beverages.jpg' },
    { storeId: store1.id, categoryId: catBev.id, name: 'Iced Lemon Tea', description: 'Brewed tea with lemon & ice.', price: 70, stock: 35, gstRate: 12, hsnCode: '2202', imageUrl: '/images/beverages.jpg' },
    // Extras
    { storeId: store1.id, categoryId: catExtra.id, name: 'Crispy Fries', description: 'Golden french fries with peri-peri seasoning.', price: 80, stock: 50, gstRate: 5, hsnCode: '2106', imageUrl: '/images/extras.jpg' },
    { storeId: store1.id, categoryId: catExtra.id, name: 'Cheesy Potato Wedges', description: 'Baked wedges loaded with cheese & jalapeños.', price: 110, stock: 12, gstRate: 5, hsnCode: '2106', imageUrl: '/images/extras.jpg' },
    { storeId: store1.id, categoryId: catExtra.id, name: 'Garlic Bread Sticks', description: 'Oven-baked bread sticks with garlic butter & herbs.', price: 90, stock: 20, gstRate: 5, hsnCode: '2106', imageUrl: '/images/extras.jpg' },
    // Combos (treated as items)
    { storeId: store1.id, categoryId: catCombo.id, name: 'Classic Combo', description: 'Chicken Burger + Fries + Cold Coffee. Best value.', price: 290, stock: 30, gstRate: 5, hsnCode: '2106', imageUrl: '/images/combos.jpg', isBestseller: true },
    { storeId: store1.id, categoryId: catCombo.id, name: 'Roll Meal', description: 'Chicken Kathi Roll + Fresh Lime Soda + Garlic Bread.', price: 240, stock: 20, gstRate: 5, hsnCode: '2106', imageUrl: '/images/combos.jpg' },
    { storeId: store1.id, categoryId: catCombo.id, name: 'Burger Feast', description: 'Double Trouble Burger + Cheesy Wedges + Iced Tea.', price: 380, stock: 15, gstRate: 5, hsnCode: '2106', imageUrl: '/images/combos.jpg' },
  ];

  for (const item of itemsData) {
    await prisma.item.create({ data: item });
  }

  // Replicate for Store 2 (simplified)
  for (const item of itemsData) {
    await prisma.item.create({
      data: { ...item, storeId: store2.id, id: undefined } as any
    });
  }

  console.log('Seed completed.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
