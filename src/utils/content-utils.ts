import { type CollectionEntry, getCollection } from "astro:content";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { getCategoryUrl } from "@utils/url-utils.ts";

// // Retrieve posts and sort them by publication date
async function getRawSortedPosts() {
	const allBlogPosts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	const sorted = allBlogPosts.sort((a, b) => {
		const dateA = new Date(a.data.published);
		const dateB = new Date(b.data.published);
		return dateA > dateB ? -1 : 1;
	});
	return sorted;
}

export async function getSortedPosts() {
	const sorted = await getRawSortedPosts();

	for (let i = 1; i < sorted.length; i++) {
		sorted[i].data.nextSlug = sorted[i - 1].slug;
		sorted[i].data.nextTitle = sorted[i - 1].data.title;
	}
	for (let i = 0; i < sorted.length - 1; i++) {
		sorted[i].data.prevSlug = sorted[i + 1].slug;
		sorted[i].data.prevTitle = sorted[i + 1].data.title;
	}

	return sorted;
}
export type PostForList = {
	slug: string;
	data: CollectionEntry<"posts">["data"];
};
export async function getSortedPostsList(): Promise<PostForList[]> {
	const sortedFullPosts = await getRawSortedPosts();

	// delete post.body
	const sortedPostsList = sortedFullPosts.map((post) => ({
		slug: post.slug,
		data: post.data,
	}));

	return sortedPostsList;
}
export type Tag = {
	name: string;
	count: number;
};

export async function getTagList(): Promise<Tag[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	const countMap: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { tags: string[] } }) => {
		post.data.tags.forEach((tag: string) => {
			if (!countMap[tag]) countMap[tag] = 0;
			countMap[tag]++;
		});
	});

	// sort tags
	const keys: string[] = Object.keys(countMap).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	return keys.map((key) => ({ name: key, count: countMap[key] }));
}

export type Category = {
	name: string;
	count: number;
	url: string;
	level: number;
	parent?: string;
	fullPath: string;
};

export async function getCategoryList(): Promise<Category[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	console.log("[DEBUG] getCategoryList - allBlogPosts:", allBlogPosts.length);
	console.log(
		"[DEBUG] allBlogPosts categories:",
		allBlogPosts.map((p) => p.data.category),
	);

	const count: { [key: string]: number } = {};
	const childCounts: { [key: string]: number } = {};

	allBlogPosts.forEach((post) => {
		const category = post.data.category ?? i18n(I18nKey.uncategorized);
		count[category] = (count[category] ?? 0) + 1;

		// 记录子分类数量（用于父分类）
		const parts = category.split("/");
		if (parts.length > 1) {
			const parentPath = parts.slice(0, -1).join("/");
			childCounts[parentPath] = (childCounts[parentPath] ?? 0) + 1;
		}
	});

	console.log("[DEBUG] count:", count);
	console.log("[DEBUG] childCounts:", childCounts);

	// 收集所有分类路径（包括父分类）
	const allPaths = new Set<string>(Object.keys(count));
	for (const path of Object.keys(childCounts)) {
		allPaths.add(path);
	}

	console.log("[DEBUG] allPaths:", [...allPaths]);

	const lst = [...allPaths].sort((a, b) =>
		a.toLowerCase().localeCompare(b.toLowerCase()),
	);

	const ret: Category[] = [];
	for (const c of lst) {
		const parts = c.split("/");
		const hasChildren = c in childCounts; // 是否有子分类
		const hasPosts = c in count; // 是否有直接文章

		let categoryCount: number;
		if (hasChildren && hasPosts) {
			// 如果既有子分类又有直接文章，显示总数量（子分类文章数 + 直接文章数）
			categoryCount = (childCounts[c] ?? 0) + (count[c] ?? 0);
		} else if (hasChildren) {
			// 只有子分类，显示子分类数量
			categoryCount = childCounts[c] ?? 0;
		} else {
			// 只有直接文章或无内容
			categoryCount = count[c] ?? 0;
		}

		ret.push({
			name: parts[parts.length - 1],
			count: categoryCount,
			url: getCategoryUrl(c),
			level: parts.length,
			parent: parts.length > 1 ? parts.slice(0, -1).join("/") : undefined,
			fullPath: c,
		});
	}

	console.log("[DEBUG] getCategoryList result:", ret);
	return ret;
}

export type CategoryTreeNode = Category & {
	children?: CategoryTreeNode[];
};

export async function getCategoryTree(): Promise<CategoryTreeNode[]> {
	const categories = await getCategoryList();
	console.log("[DEBUG] getCategoryTree - categories:", categories);

	const categoryMap = new Map<string, CategoryTreeNode>();
	const rootCategories: CategoryTreeNode[] = [];

	// 首先按层级排序，确保父分类在子分类之前处理
	const sortedCategories = [...categories].sort((a, b) => a.level - b.level);
	console.log(
		"[DEBUG] getCategoryTree - sortedCategories:",
		sortedCategories.map((c) => ({
			name: c.name,
			level: c.level,
			parent: c.parent,
		})),
	);

	sortedCategories.forEach((cat) => {
		categoryMap.set(cat.fullPath, { ...cat, children: [] });
	});

	sortedCategories.forEach((cat) => {
		const node = categoryMap.get(cat.fullPath);
		if (!node) return;
		if (cat.parent && categoryMap.has(cat.parent)) {
			const parentNode = categoryMap.get(cat.parent);
			if (!parentNode) {
				rootCategories.push(node);
				return;
			}
			if (!parentNode.children) parentNode.children = [];
			parentNode.children.push(node);
		} else {
			rootCategories.push(node);
		}
	});

	console.log("[DEBUG] getCategoryTree - rootCategories:", rootCategories);
	return rootCategories;
}
