import React, { useState, useEffect } from 'react';

interface Tab {
    id: string | number;
    title: string;
}

interface TabListProps {
    tabList: Tab[];
}

function TabList({ tabList }: TabListProps) {
    return (
        <div>
            <h2>Tab List</h2>
            <ul>
                {tabList.map((tab: Tab) => (
                    <li key={tab.id}>{tab.title}</li>
                ))}
            </ul>
        </div>
    );
};

export { TabList, TabListProps, Tab };